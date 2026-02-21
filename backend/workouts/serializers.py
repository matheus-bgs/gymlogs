from rest_framework import serializers
from .models import Exercise, WorkoutSession, WorkoutExercise, SetEntry, IntensityMethod

class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = '__all__'

class SetEntryPayloadSerializer(serializers.Serializer):
    order = serializers.IntegerField()
    weight = serializers.FloatField()
    reps = serializers.IntegerField()
    reached_failure = serializers.BooleanField(default=False)
    intensity_method = serializers.CharField(max_length=50, default='none')

class WorkoutSerializer(serializers.Serializer):
    date = serializers.DateField()
    exercise = serializers.PrimaryKeyRelatedField(queryset=Exercise.objects.all())
    notes = serializers.CharField(allow_blank=True, required=False)
    sets = SetEntryPayloadSerializer(many=True)

    def create(self, validated_data):
        user = self.context['request'].user
        date = validated_data['date']
        exercise = validated_data['exercise']
        notes = validated_data.get('notes', '')
        sets_data = validated_data['sets']

        # 1. Get or create WorkoutSession for the user and date
        session, _ = WorkoutSession.objects.get_or_create(
            user=user,
            date=date,
            defaults={'notes': notes}
        )

        # 2. Create WorkoutExercise
        current_exercises = session.exercises.count()
        workout_exercise = WorkoutExercise.objects.create(
            workout_session=session,
            exercise=exercise,
            order=current_exercises + 1,
            notes=notes
        )

        # 3. Create SetEntries
        for set_data in sets_data:
            intensity_name = set_data.pop('intensity_method', 'none')
            intensity, _ = IntensityMethod.objects.get_or_create(name=intensity_name)
            
            SetEntry.objects.create(
                workout_exercise=workout_exercise,
                intensity_method=intensity,
                **set_data
            )

        return session
