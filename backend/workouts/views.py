from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Max, Sum, Count, ExpressionWrapper, FloatField, F, Avg
from django.db.models import Prefetch
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
import datetime
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry, WorkoutPlan, PlanDay, PlanExercise, UserProfile, BodyWeightEntry
from .serializers import (
    ExerciseSerializer, WorkoutSerializer,
    WorkoutPlanSerializer, PlanDaySerializer, PlanExerciseSerializer,
    UserProfileSerializer, SetEntryUpdateSerializer, BodyWeightEntrySerializer,
)


class RegisterView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        email = request.data.get('email', '').strip()
        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username is already taken.'}, status=400)
        user = User.objects.create_user(
            username=username, password=password, email=email)
        return Response({'message': f'User "{user.username}" created successfully.'}, status=201)


class DebugDBView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            users = list(User.objects.values(
                'username', 'is_active', 'is_superuser'))
            return Response({'status': 'connected', 'users': users})
        except Exception as e:
            import traceback
            return Response({'status': 'error', 'detail': traceback.format_exc()}, status=500)


class ExerciseListView(generics.ListCreateAPIView):
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.query_params.get('with_data') == 'true':
            logged_ids = WorkoutExercise.objects.filter(
                workout_session__user=self.request.user
            ).values_list('exercise_id', flat=True).distinct()
            return Exercise.objects.filter(id__in=logged_ids)
        return Exercise.objects.all()


class WorkoutCreateView(generics.CreateAPIView):
    serializer_class = WorkoutSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        # Return the newly created sets with their IDs so the frontend can support post-session editing
        latest_we = session.exercises.order_by('-id').first()
        sets_with_ids = []
        if latest_we:
            sets_with_ids = [
                {'id': s.id, 'order': s.order, 'weight': s.weight, 'reps': s.reps,
                 'reached_failure': s.reached_failure,
                 'intensity_method': s.intensity_method.name if s.intensity_method else 'none'}
                for s in latest_we.sets.order_by('order')
            ]
        return Response({'status': 'ok', 'sets': sets_with_ids}, status=status.HTTP_201_CREATED)


class LastWorkoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exercise_id = request.query_params.get('exercise_id')
        if not exercise_id:
            return Response({"error": "exercise_id is required"}, status=400)
        last_workout_exercise = WorkoutExercise.objects.filter(
            workout_session__user=request.user,
            exercise_id=exercise_id
        ).order_by('-workout_session__date').first()
        if not last_workout_exercise:
            return Response({"data": None})
        sets = SetEntry.objects.filter(
            workout_exercise=last_workout_exercise
        ).select_related('intensity_method').order_by('order')
        sets_data = [{
            'order': s.order, 'weight': s.weight, 'reps': s.reps,
            'reached_failure': s.reached_failure,
            'intensity_method': s.intensity_method.name if s.intensity_method else 'none'
        } for s in sets]
        return Response({"data": {
            'date': last_workout_exercise.workout_session.date,
            'notes': last_workout_exercise.notes,
            'sets': sets_data
        }})


class TopsetsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exercise_id = request.query_params.get('exercise_id')
        qs = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user)
        if exercise_id:
            qs = qs.filter(workout_exercise__exercise_id=exercise_id)
        rows = (
            qs
            .annotate(date=F('workout_exercise__workout_session__date'))
            .values('date')
            .annotate(
                topset=Max(ExpressionWrapper(F('weight') *
                           F('reps'), output_field=FloatField())),
                max_weight=Max('weight'),
                total_volume=Sum(ExpressionWrapper(
                    F('weight') * F('reps'), output_field=FloatField())),
                intensity_count=Count('intensity_method'),
                best_1rm=Max(ExpressionWrapper(
                    F('weight') * (1.0 + F('reps') / 30.0), output_field=FloatField())),
            )
            .order_by('date')
        )
        result = [{
            'date': str(r['date']),
            'topset': r['topset'],
            'max_weight': r['max_weight'],
            'total_volume': r['total_volume'],
            'has_intensity': r['intensity_count'] > 0,
            'est_1rm': round(r['best_1rm'], 2) if r['best_1rm'] else None,
        } for r in rows]
        return Response({'data': result})


# ---------------------------------------------------------------------------
# Plan views
# ---------------------------------------------------------------------------

class WorkoutPlanView(views.APIView):
    """GET the user's active plan (or null). POST to create a new plan (deactivates old)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = WorkoutPlan.objects.filter(user=request.user, is_active=True).prefetch_related(
            'days__exercises__exercise'
        ).first()
        if not plan:
            return Response({'data': None})
        last_session = WorkoutSession.objects.filter(
            user=request.user,
            plan_day__plan=plan,
        ).order_by('-date').first()
        plan_data = WorkoutPlanSerializer(plan).data
        plan_data['last_day_id'] = last_session.plan_day_id if last_session else None
        return Response({'data': plan_data})

    def post(self, request):
        serializer = WorkoutPlanSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        plan = serializer.save()
        return Response({'data': WorkoutPlanSerializer(plan).data}, status=201)


class PlanDetailView(views.APIView):
    """PATCH plan name. DELETE the whole plan."""
    permission_classes = [IsAuthenticated]

    def _get_plan(self, request, plan_id):
        try:
            return WorkoutPlan.objects.get(id=plan_id, user=request.user)
        except WorkoutPlan.DoesNotExist:
            return None

    def get(self, request, plan_id):
        plan = self._get_plan(request, plan_id)
        if not plan:
            return Response({'error': 'Not found.'}, status=404)
        plan_with_data = WorkoutPlan.objects.prefetch_related(
            'days__exercises__exercise'
        ).get(id=plan_id, user=request.user)
        return Response({'data': WorkoutPlanSerializer(plan_with_data).data})

    def patch(self, request, plan_id):
        plan = self._get_plan(request, plan_id)
        if not plan:
            return Response({'error': 'Not found.'}, status=404)
        name = request.data.get('name')
        if name:
            plan.name = name
        if 'is_active' in request.data and request.data['is_active']:
            WorkoutPlan.objects.filter(
                user=request.user, is_active=True).update(is_active=False)
            plan.is_active = True
        plan.save()
        return Response({'data': WorkoutPlanSerializer(plan).data})

    def delete(self, request, plan_id):
        plan = self._get_plan(request, plan_id)
        if not plan:
            return Response({'error': 'Not found.'}, status=404)
        plan.delete()
        return Response(status=204)


class PlanDayView(views.APIView):
    """POST to add a day to a plan."""
    permission_classes = [IsAuthenticated]

    def post(self, request, plan_id):
        try:
            plan = WorkoutPlan.objects.get(id=plan_id, user=request.user)
        except WorkoutPlan.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        label = request.data.get('label', '').strip().upper()
        if not label:
            return Response({'error': 'label is required.'}, status=400)
        if PlanDay.objects.filter(plan=plan, label=label).exists():
            return Response({'error': f'Day "{label}" already exists in this plan.'}, status=400)
        order = PlanDay.objects.filter(plan=plan).count()
        day = PlanDay.objects.create(plan=plan, label=label, order=order)
        return Response({'data': PlanDaySerializer(day).data}, status=201)


class PlanDayDetailView(views.APIView):
    """DELETE a plan day (cascades to its PlanExercises)."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, plan_id, day_id):
        try:
            day = PlanDay.objects.get(
                id=day_id, plan__id=plan_id, plan__user=request.user)
        except PlanDay.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        day.delete()
        return Response(status=204)


class PlanExerciseView(views.APIView):
    """POST to add an exercise to a plan day."""
    permission_classes = [IsAuthenticated]

    def post(self, request, plan_id, day_id):
        try:
            day = PlanDay.objects.get(
                id=day_id, plan__id=plan_id, plan__user=request.user)
        except PlanDay.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        serializer = PlanExerciseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        order = PlanExercise.objects.filter(plan_day=day).count()
        pe = PlanExercise.objects.create(
            plan_day=day,
            exercise=data['exercise'],
            order=order,
            target_sets=data.get('target_sets', 3),
            reps_min=data.get('reps_min', 6),
            reps_max=data.get('reps_max', 12),
        )
        return Response({'data': PlanExerciseSerializer(pe).data}, status=201)


class PlanExerciseDetailView(views.APIView):
    """PATCH fields (target_sets, reps_min, reps_max). DELETE a plan exercise."""
    permission_classes = [IsAuthenticated]

    def _get_pe(self, request, plan_id, day_id, ex_id):
        try:
            return PlanExercise.objects.get(
                id=ex_id, plan_day__id=day_id,
                plan_day__plan__id=plan_id, plan_day__plan__user=request.user
            )
        except PlanExercise.DoesNotExist:
            return None

    def patch(self, request, plan_id, day_id, ex_id):
        pe = self._get_pe(request, plan_id, day_id, ex_id)
        if not pe:
            return Response({'error': 'Not found.'}, status=404)
        for field in ['target_sets', 'reps_min', 'reps_max', 'order']:
            if field in request.data:
                setattr(pe, field, request.data[field])
        if 'exercise_id' in request.data:
            try:
                pe.exercise = Exercise.objects.get(
                    id=request.data['exercise_id'])
            except Exercise.DoesNotExist:
                return Response({'error': 'Exercise not found.'}, status=404)
        pe.save()
        return Response({'data': PlanExerciseSerializer(pe).data})

    def delete(self, request, plan_id, day_id, ex_id):
        pe = self._get_pe(request, plan_id, day_id, ex_id)
        if not pe:
            return Response({'error': 'Not found.'}, status=404)
        pe.delete()
        return Response(status=204)


class PlanExerciseReorderView(views.APIView):
    """POST [{id, order}, ...] to bulk-update exercise order within a day."""
    permission_classes = [IsAuthenticated]

    def post(self, request, plan_id, day_id):
        try:
            day = PlanDay.objects.get(
                id=day_id, plan__id=plan_id, plan__user=request.user)
        except PlanDay.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        items = request.data  # expected: [{id, order}, ...]
        if not isinstance(items, list):
            return Response({'error': 'Expected a list of {id, order} objects.'}, status=400)
        ids = [item['id'] for item in items]
        exercises = {pe.id: pe for pe in PlanExercise.objects.filter(
            id__in=ids, plan_day=day)}
        for item in items:
            pe = exercises.get(item['id'])
            if pe:
                pe.order = item['order']
        PlanExercise.objects.bulk_update(list(exercises.values()), ['order'])
        updated = PlanExercise.objects.filter(
            plan_day=day).select_related('exercise').order_by('order')
        return Response({'data': PlanExerciseSerializer(updated, many=True).data})


class SessionProgressView(views.APIView):
    """
    GET /api/workouts/session-progress/?date=YYYY-MM-DD&plan_day_id=X
    Returns the list of exercise IDs already logged for that user+date session.
    Used by the frontend to resume a partially-completed plan day after a page refresh.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date = request.query_params.get('date')
        plan_day_id = request.query_params.get('plan_day_id')
        if not date or not plan_day_id:
            return Response({'error': 'date and plan_day_id are required.'}, status=400)
        session = WorkoutSession.objects.filter(
            user=request.user, date=date
        ).first()
        if not session:
            return Response({'data': []})
        logged_ids = list(
            WorkoutExercise.objects.filter(workout_session=session)
            .values_list('exercise_id', flat=True)
        )
        return Response({'data': logged_ids})


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------

class UserProfileView(views.APIView):
    """GET or PATCH the current user's profile (weight_unit preference)."""
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        return Response({'data': UserProfileSerializer(self._get_profile(request.user)).data})

    def patch(self, request):
        profile = self._get_profile(request.user)
        serializer = UserProfileSerializer(
            profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'data': UserProfileSerializer(profile).data})


# ---------------------------------------------------------------------------
# Set editing
# ---------------------------------------------------------------------------

class SetEntryUpdateView(views.APIView):
    """PATCH weight/reps on an individual set owned by the requesting user."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, set_id):
        try:
            set_entry = SetEntry.objects.select_related(
                'workout_exercise__workout_session'
            ).get(id=set_id, workout_exercise__workout_session__user=request.user)
        except SetEntry.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)
        serializer = SetEntryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if 'weight' in serializer.validated_data:
            set_entry.weight = serializer.validated_data['weight']
        if 'reps' in serializer.validated_data:
            set_entry.reps = serializer.validated_data['reps']
        set_entry.save()
        return Response({'data': {'id': set_entry.id, 'weight': set_entry.weight, 'reps': set_entry.reps}})


# ---------------------------------------------------------------------------
# Body weight tracking
# ---------------------------------------------------------------------------

class BodyWeightView(views.APIView):
    """GET today + last entry; POST upserts an entry for a given date."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.date.today()
        today_entry = BodyWeightEntry.objects.filter(
            user=request.user, date=today).first()
        last_entry = BodyWeightEntry.objects.filter(
            user=request.user, date__lt=today).order_by('-date').first()
        return Response({
            'data': {
                'today': BodyWeightEntrySerializer(today_entry).data if today_entry else None,
                'last': BodyWeightEntrySerializer(last_entry).data if last_entry else None,
            }
        })

    def post(self, request):
        weight = request.data.get('weight')
        date_str = request.data.get('date')
        if weight is None:
            return Response({'error': 'weight is required.'}, status=400)
        try:
            weight = float(weight)
            if weight <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': 'weight must be a positive number.'}, status=400)
        try:
            entry_date = datetime.date.fromisoformat(date_str) if date_str else datetime.date.today()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)
        entry, _ = BodyWeightEntry.objects.update_or_create(
            user=request.user,
            date=entry_date,
            defaults={'weight': weight},
        )
        return Response({'data': BodyWeightEntrySerializer(entry).data}, status=200)


# ---------------------------------------------------------------------------
# Workout history
# ---------------------------------------------------------------------------

class WorkoutHistoryView(views.APIView):
    """GET all workout sessions for the current user with nested exercises+sets."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = WorkoutSession.objects.filter(
            user=request.user
        ).prefetch_related(
            Prefetch('exercises__sets', queryset=SetEntry.objects.select_related('intensity_method').order_by('order')),
            'exercises__exercise',
            'plan_day',
        ).order_by('-date')

        data = []
        for s in sessions:
            exercises = []
            for we in s.exercises.all():
                sets = [{
                    'id': se.id,
                    'order': se.order,
                    'weight': se.weight,
                    'reps': se.reps,
                    'reached_failure': se.reached_failure,
                    'intensity_method': se.intensity_method.name if se.intensity_method else 'none',
                } for se in we.sets.all()]
                exercises.append({
                    'id': we.id,
                    'exercise': {
                        'id': we.exercise.id,
                        'name': we.exercise.name,
                        'name_pt': we.exercise.name_pt,
                    },
                    'notes': we.notes,
                    'duration_seconds': we.duration_seconds,
                    'sets': sets,
                })
            data.append({
                'id': s.id,
                'date': str(s.date),
                'notes': s.notes,
                'plan_day_label': s.plan_day.label if s.plan_day else None,
                'duration_seconds': s.duration_seconds,
                'exercises': exercises,
            })
        return Response({'data': data})


# ---------------------------------------------------------------------------
# Dashboard endpoints
# ---------------------------------------------------------------------------

class WeightHistoryView(views.APIView):
    """GET all body weight entries for the current user, ascending by date."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = BodyWeightEntry.objects.filter(
            user=request.user
        ).order_by('date')
        data = [{'date': str(e.date), 'weight': e.weight} for e in entries]
        return Response({'data': data})


class DashboardSummaryView(views.APIView):
    """
    GET /api/dashboard/summary/?days=<int>
    Returns KPI card data: weight, sessions, tonnage, avg duration, streak, PRs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            return Response({'error': 'days must be an integer.'}, status=400)

        today = datetime.date.today()
        current_start = today - datetime.timedelta(days=days)
        prior_start = current_start - datetime.timedelta(days=days)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        weight_unit = profile.weight_unit

        def convert(val):
            if val is None:
                return None
            return round(val * 2.20462, 2) if weight_unit == 'lbs' else round(val, 2)

        # ── Body weight ───────────────────────────────────────────────────────
        latest_entry = BodyWeightEntry.objects.filter(
            user=request.user
        ).order_by('-date').first()
        current_weight = convert(latest_entry.weight) if latest_entry else None

        prior_weight_entry = BodyWeightEntry.objects.filter(
            user=request.user, date__lte=current_start
        ).order_by('-date').first()
        prior_weight = convert(prior_weight_entry.weight) if prior_weight_entry else None
        weight_delta = None
        if current_weight is not None and prior_weight is not None:
            weight_delta = round(current_weight - prior_weight, 2)

        # ── Sessions ─────────────────────────────────────────────────────────
        sessions_current = WorkoutSession.objects.filter(
            user=request.user, date__gte=current_start
        ).count()
        sessions_prior = WorkoutSession.objects.filter(
            user=request.user, date__gte=prior_start, date__lt=current_start
        ).count()

        # ── Tonnage ──────────────────────────────────────────────────────────
        def tonnage_in_range(start, end):
            agg = SetEntry.objects.filter(
                workout_exercise__workout_session__user=request.user,
                workout_exercise__workout_session__date__gte=start,
                workout_exercise__workout_session__date__lte=end,
            ).aggregate(
                t=Sum(ExpressionWrapper(F('weight') * F('reps'), output_field=FloatField()))
            )
            raw = agg['t'] or 0.0
            return convert(raw)

        tonnage_current = tonnage_in_range(current_start, today)
        tonnage_prior = tonnage_in_range(prior_start, current_start - datetime.timedelta(days=1))

        # ── Avg duration ─────────────────────────────────────────────────────
        def avg_duration(start, end):
            agg = WorkoutSession.objects.filter(
                user=request.user,
                date__gte=start, date__lte=end,
                duration_seconds__isnull=False,
            ).aggregate(a=Avg('duration_seconds'))
            return round(agg['a'] / 60, 1) if agg['a'] else None

        avg_dur_current = avg_duration(current_start, today)
        avg_dur_prior = avg_duration(prior_start, current_start - datetime.timedelta(days=1))
        avg_dur_delta = None
        if avg_dur_current is not None and avg_dur_prior is not None:
            avg_dur_delta = round(avg_dur_current - avg_dur_prior, 1)

        # ── Active streak (trailing weeks with >= 1 session) ─────────────────
        # Look back up to 52 weeks from today
        streak = 0
        check_date = today
        for _ in range(52):
            week_start = check_date - datetime.timedelta(days=check_date.weekday())
            week_end = week_start + datetime.timedelta(days=6)
            if WorkoutSession.objects.filter(
                user=request.user, date__gte=week_start, date__lte=week_end
            ).exists():
                streak += 1
                check_date = week_start - datetime.timedelta(days=1)
            else:
                break

        # ── PRs set in last 30 days ───────────────────────────────────────────
        thirty_days_ago = today - datetime.timedelta(days=30)
        # For each exercise, find max weight in last 30d vs before
        pr_count = 0
        exercise_ids = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user
        ).values_list('workout_exercise__exercise_id', flat=True).distinct()
        for ex_id in exercise_ids:
            recent_max = SetEntry.objects.filter(
                workout_exercise__workout_session__user=request.user,
                workout_exercise__exercise_id=ex_id,
                workout_exercise__workout_session__date__gte=thirty_days_ago,
            ).aggregate(m=Max('weight'))['m']
            historic_max = SetEntry.objects.filter(
                workout_exercise__workout_session__user=request.user,
                workout_exercise__exercise_id=ex_id,
                workout_exercise__workout_session__date__lt=thirty_days_ago,
            ).aggregate(m=Max('weight'))['m']
            if recent_max is not None:
                if historic_max is None or recent_max > historic_max:
                    pr_count += 1

        return Response({'data': {
            'current_weight': current_weight,
            'weight_delta': weight_delta,
            'weight_unit': weight_unit,
            'sessions_current': sessions_current,
            'sessions_prior': sessions_prior,
            'tonnage_current': tonnage_current,
            'tonnage_prior': tonnage_prior,
            'avg_duration_minutes': avg_dur_current,
            'avg_duration_delta': avg_dur_delta,
            'streak_weeks': streak,
            'pr_count_30d': pr_count,
        }})


class VolumeByMuscleView(views.APIView):
    """
    GET /api/dashboard/volume-by-muscle/?days=<int>
    Returns per-day tonnage/sets/reps by muscle group  +  aggregated totals.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            return Response({'error': 'days must be an integer.'}, status=400)

        today = datetime.date.today()
        start = today - datetime.timedelta(days=days)

        qs = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user,
            workout_exercise__workout_session__date__gte=start,
        ).annotate(
            session_date=F('workout_exercise__workout_session__date'),
            muscle=F('workout_exercise__exercise__muscle_group'),
        ).values('session_date', 'muscle')

        qs = qs.annotate(
            tonnage=Sum(ExpressionWrapper(F('weight') * F('reps'), output_field=FloatField())),
            total_sets=Count('id'),
            total_reps=Sum('reps'),
        ).order_by('session_date', 'muscle')

        by_day = [
            {
                'date': str(r['session_date']),
                'muscle_group': r['muscle'] or 'Other',
                'tonnage': round(r['tonnage'] or 0, 2),
                'sets': r['total_sets'],
                'reps': r['total_reps'] or 0,
            }
            for r in qs
        ]

        # Aggregate totals per muscle group
        agg = {}
        for row in by_day:
            mg = row['muscle_group']
            if mg not in agg:
                agg[mg] = {'muscle_group': mg, 'tonnage': 0.0, 'sets': 0, 'reps': 0}
            agg[mg]['tonnage'] += row['tonnage']
            agg[mg]['sets'] += row['sets']
            agg[mg]['reps'] += row['reps']
        by_muscle = sorted(agg.values(), key=lambda x: -x['tonnage'])
        for r in by_muscle:
            r['tonnage'] = round(r['tonnage'], 2)

        return Response({'data': {'by_muscle': by_muscle, 'by_day': by_day}})


class TrainingCalendarView(views.APIView):
    """
    GET /api/dashboard/training-calendar/?year=<int>
    Returns per-day session data for the heatmap (last 365 days by default).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.date.today()
        start = today - datetime.timedelta(days=364)

        sessions = WorkoutSession.objects.filter(
            user=request.user,
            date__gte=start,
        ).prefetch_related('plan_day').order_by('date')

        # Group by date
        by_date = {}
        for s in sessions:
            d = str(s.date)
            if d not in by_date:
                by_date[d] = {
                    'date': d,
                    'session_count': 0,
                    'tonnage': 0.0,
                    'plan_day_labels': [],
                }
            by_date[d]['session_count'] += 1
            if s.plan_day and s.plan_day.label not in by_date[d]['plan_day_labels']:
                by_date[d]['plan_day_labels'].append(s.plan_day.label)

        # Add tonnage per day
        tonnage_qs = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user,
            workout_exercise__workout_session__date__gte=start,
        ).annotate(
            session_date=F('workout_exercise__workout_session__date'),
        ).values('session_date').annotate(
            t=Sum(ExpressionWrapper(F('weight') * F('reps'), output_field=FloatField()))
        )
        for row in tonnage_qs:
            d = str(row['session_date'])
            if d in by_date:
                by_date[d]['tonnage'] = round(row['t'] or 0, 2)

        return Response({'data': sorted(by_date.values(), key=lambda x: x['date'])})
