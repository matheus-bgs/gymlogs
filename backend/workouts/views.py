from django.shortcuts import render
from rest_framework import generics, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry
from .serializers import ExerciseSerializer, WorkoutSerializer
import pandas as pd


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
                'volume': s.volume()
            })

        df = pd.DataFrame(data)

        # Group by date, compute max volume, sort by date
        topsets = df.groupby('date')['volume'].max().reset_index()
        topsets = topsets.sort_values('date')

        # Rename volume to topset
        topsets = topsets.rename(columns={'volume': 'topset'})

        # Convert date to string
        topsets['date'] = topsets['date'].astype(str)

        result = topsets.to_dict('records')

        return Response({"data": result})
