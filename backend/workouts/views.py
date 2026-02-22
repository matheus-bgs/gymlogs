from django.shortcuts import render
from django.contrib.auth.models import User
from rest_framework import generics, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry
from .serializers import ExerciseSerializer, WorkoutSerializer
import pandas as pd


class DebugDBView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            users = list(User.objects.values('username', 'is_active', 'is_superuser'))
            return Response({'status': 'connected', 'users': users})
        except Exception as e:
            return Response({'status': 'error', 'detail': str(e)}, status=500)


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
            workout_exercise=last_workout_exercise).order_by('order')

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

        sets = SetEntry.objects.filter(
            workout_exercise__workout_session__user=request.user)
        if exercise_id:
            sets = sets.filter(workout_exercise__exercise_id=exercise_id)

        if not sets.exists():
            return Response({"data": []})

        data = []
        for s in sets:
            data.append({
                'date': s.workout_exercise.workout_session.date,
                'volume': s.volume(),
                'weight': s.weight,
                'has_intensity': s.intensity_method_id is not None
            })

        df = pd.DataFrame(data)

        # Group by date, compute max volume, max weight, and any intensity
        grouped = df.groupby('date').agg(
            topset=('volume', 'max'),
            max_weight=('weight', 'max'),
            has_intensity=('has_intensity', 'any')
        ).reset_index()

        grouped = grouped.sort_values('date')

        # Convert date to string and has_intensity to bool
        grouped['date'] = grouped['date'].astype(str)
        grouped['has_intensity'] = grouped['has_intensity'].astype(bool)

        result = grouped.to_dict('records')

        return Response({"data": result})
