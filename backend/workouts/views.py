from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Max, Sum, Count, ExpressionWrapper, FloatField, F
from rest_framework import generics, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry
from .serializers import ExerciseSerializer, WorkoutSerializer


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
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]


class WorkoutCreateView(generics.CreateAPIView):
    serializer_class = WorkoutSerializer
    permission_classes = [IsAuthenticated]


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
