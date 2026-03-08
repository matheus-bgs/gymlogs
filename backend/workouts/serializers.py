from rest_framework import serializers
from .models import (
    Exercise, WorkoutSession, WorkoutExercise, SetEntry, IntensityMethod,
    WorkoutPlan, PlanDay, PlanExercise, UserProfile, BodyWeightEntry,
)


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = '__all__'


# ---------------------------------------------------------------------------
# Plan serializers
# ---------------------------------------------------------------------------

class PlanExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    exercise_id = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all(), source='exercise', write_only=True
    )

    class Meta:
        model = PlanExercise
        fields = ['id', 'exercise', 'exercise_id',
                  'order', 'target_sets', 'reps_min', 'reps_max']


class PlanDaySerializer(serializers.ModelSerializer):
    exercises = PlanExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = PlanDay
        fields = ['id', 'label', 'order', 'exercises']


class WorkoutPlanSerializer(serializers.ModelSerializer):
    days = PlanDaySerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutPlan
        fields = ['id', 'name', 'is_active', 'days', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        # Deactivate any existing active plan for this user
        WorkoutPlan.objects.filter(
            user=user, is_active=True).update(is_active=False)
        plan = WorkoutPlan.objects.create(
            user=user, is_active=True, **validated_data)
        return plan


# ---------------------------------------------------------------------------
# Workout logging serializers
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['weight_unit']


class BodyWeightEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = BodyWeightEntry
        fields = ['id', 'date', 'weight']


class SetEntryPayloadSerializer(serializers.Serializer):
    order = serializers.IntegerField()
    weight = serializers.FloatField()
    reps = serializers.IntegerField()
    reached_failure = serializers.BooleanField(default=False)
    intensity_method = serializers.CharField(max_length=50, default='none')

    def validate_weight(self, value):
        if value < 0:
            raise serializers.ValidationError('Weight must be non-negative.')
        return value

    def validate_reps(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Reps must be a positive integer.')
        return value


class SetEntryUpdateSerializer(serializers.Serializer):
    weight = serializers.FloatField(required=False)
    reps = serializers.IntegerField(required=False)

    def validate_weight(self, value):
        if value < 0:
            raise serializers.ValidationError('Weight must be non-negative.')
        return value

    def validate_reps(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Reps must be a positive integer.')
        return value


class WorkoutSerializer(serializers.Serializer):
    date = serializers.DateField()
    exercise = serializers.PrimaryKeyRelatedField(
        queryset=Exercise.objects.all())
    notes = serializers.CharField(allow_blank=True, required=False)
    sets = SetEntryPayloadSerializer(many=True)
    plan_day = serializers.PrimaryKeyRelatedField(
        queryset=PlanDay.objects.all(), required=False, allow_null=True
    )
    plan_exercise = serializers.PrimaryKeyRelatedField(
        queryset=PlanExercise.objects.all(), required=False, allow_null=True
    )
    exercise_duration_seconds = serializers.IntegerField(
        required=False, allow_null=True, min_value=0)
    session_duration_seconds = serializers.IntegerField(
        required=False, allow_null=True, min_value=0)

    def create(self, validated_data):
        user = self.context['request'].user
        date = validated_data['date']
        exercise = validated_data['exercise']
        notes = validated_data.get('notes', '')
        sets_data = validated_data['sets']
        plan_day = validated_data.get('plan_day', None)
        plan_exercise = validated_data.get('plan_exercise', None)
        exercise_duration_seconds = validated_data.get(
            'exercise_duration_seconds', None)
        session_duration_seconds = validated_data.get(
            'session_duration_seconds', None)

        # 1. Get or create WorkoutSession for the user and date
        session, _ = WorkoutSession.objects.get_or_create(
            user=user,
            date=date,
            defaults={'notes': notes, 'plan_day': plan_day}
        )

        # Update session duration if provided (overwrite each lap so final value is accurate)
        if session_duration_seconds is not None:
            session.duration_seconds = session_duration_seconds
            session.save(update_fields=['duration_seconds'])

        # 2. Create WorkoutExercise
        current_exercises = session.exercises.count()
        workout_exercise = WorkoutExercise.objects.create(
            workout_session=session,
            exercise=exercise,
            plan_exercise=plan_exercise,
            order=current_exercises + 1,
            notes=notes,
            duration_seconds=exercise_duration_seconds,
        )

        # 3. Create SetEntries
        for set_data in sets_data:
            intensity_name = set_data.pop('intensity_method', 'none')
            intensity, _ = IntensityMethod.objects.get_or_create(
                name=intensity_name)

            SetEntry.objects.create(
                workout_exercise=workout_exercise,
                intensity_method=intensity,
                **set_data
            )

        return session
