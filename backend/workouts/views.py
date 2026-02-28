from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Max, Sum, Count, ExpressionWrapper, FloatField, F
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry, WorkoutPlan, PlanDay, PlanExercise, UserProfile
from .serializers import (
    ExerciseSerializer, WorkoutSerializer,
    WorkoutPlanSerializer, PlanDaySerializer, PlanExerciseSerializer,
    UserProfileSerializer, SetEntryUpdateSerializer,
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
            )
            .order_by('date')
        )
        result = [{
            'date': str(r['date']),
            'topset': r['topset'],
            'max_weight': r['max_weight'],
            'total_volume': r['total_volume'],
            'has_intensity': r['intensity_count'] > 0,
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
# Workout history
# ---------------------------------------------------------------------------

class WorkoutHistoryView(views.APIView):
    """GET all workout sessions for the current user with nested exercises+sets."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = WorkoutSession.objects.filter(
            user=request.user
        ).prefetch_related(
            'exercises__exercise',
            'exercises__sets__intensity_method',
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
                } for se in we.sets.order_by('order')]
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
