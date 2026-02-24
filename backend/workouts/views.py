from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Max, Sum, Count, ExpressionWrapper, FloatField, F
from rest_framework import generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry, WorkoutPlan, PlanDay, PlanExercise
from .serializers import (
    ExerciseSerializer, WorkoutSerializer,
    WorkoutPlanSerializer, PlanDaySerializer, PlanExerciseSerializer,
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
        serializer.save()
        return Response({'status': 'ok'}, status=status.HTTP_201_CREATED)


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
        return Response({'data': WorkoutPlanSerializer(plan).data})

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
        serializer.save()
        return Response({'status': 'ok'}, status=status.HTTP_201_CREATED)


class LastWorkoutView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exercise_id = request.query_params.get('exercise_id')
        if not exercise_id:
            return Response({"error": "exercise_id is required"}, status=400)

        # Find the most recent WorkoutExercise for this user and exercise
        last_workout_exercise = WorkoutExercise.objects.filter(
            workout_session__user=request.user,
            exercise_id=exercise_id
        ).order_by('-workout_session__date').first()

        if not last_workout_exercise:
            return Response({"data": None})

        # Get the sets for this workout exercise
        sets = SetEntry.objects.filter(
            workout_exercise=last_workout_exercise
        ).select_related('intensity_method').order_by('order')

        sets_data = []
        for s in sets:
            sets_data.append({
                'order': s.order,
                'weight': s.weight,
                'reps': s.reps,
                'reached_failure': s.reached_failure,
                'intensity_method': s.intensity_method.name if s.intensity_method else 'none'
            })

        data = {
            'date': last_workout_exercise.workout_session.date,
            'notes': last_workout_exercise.notes,
            'sets': sets_data
        }

        return Response({"data": data})


class TopsetsView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        exercise_id = request.query_params.get('exercise_id')

        qs = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user
        )
        if exercise_id:
            qs = qs.filter(workout_exercise__exercise_id=exercise_id)

        # Single SQL query: group by date, compute topset volume, max weight,
        # and whether any set on that date used an intensity method.
        rows = (
            qs
            .annotate(date=F('workout_exercise__workout_session__date'))
            .values('date')
            .annotate(
                topset=Max(
                    ExpressionWrapper(F('weight') * F('reps'),
                                      output_field=FloatField())
                ),
                max_weight=Max('weight'),
                total_volume=Sum(
                    ExpressionWrapper(F('weight') * F('reps'),
                                      output_field=FloatField())
                ),
                intensity_count=Count('intensity_method'),
            )
            .order_by('date')
        )

        result = [
            {
                'date': str(r['date']),
                'topset': r['topset'],
                'max_weight': r['max_weight'],
                'total_volume': r['total_volume'],
                'has_intensity': r['intensity_count'] > 0,
            }
            for r in rows
        ]

        return Response({'data': result})
