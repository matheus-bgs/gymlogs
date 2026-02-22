from django.db import models
from django.contrib.auth.models import User
from .exercise_translations import EXERCISE_TRANSLATIONS_PT


class Exercise(models.Model):
    name = models.CharField(max_length=255, unique=True, db_index=True)
    name_pt = models.CharField(max_length=255, blank=True, null=True)
    muscle_group = models.CharField(
        max_length=100, blank=True, null=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Auto-fill name_pt from the master translations dict if not already set
        if not self.name_pt and self.name in EXERCISE_TRANSLATIONS_PT:
            self.name_pt = EXERCISE_TRANSLATIONS_PT[self.name]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class WorkoutSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    date = models.DateField(db_index=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'date']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.date}"


class WorkoutExercise(models.Model):
    workout_session = models.ForeignKey(
        WorkoutSession, related_name='exercises', on_delete=models.CASCADE, db_index=True)
    exercise = models.ForeignKey(
        Exercise, on_delete=models.RESTRICT, db_index=True)
    order = models.PositiveIntegerField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workout_session', 'exercise', 'order')

    def __str__(self):
        return f"{self.workout_session} - {self.exercise.name}"


class IntensityMethod(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class SetEntry(models.Model):
    workout_exercise = models.ForeignKey(
        WorkoutExercise, related_name='sets', on_delete=models.CASCADE, db_index=True)
    order = models.PositiveIntegerField(db_index=True)
    weight = models.FloatField(db_index=True)
    reps = models.PositiveIntegerField()
    reached_failure = models.BooleanField(default=False)
    intensity_method = models.ForeignKey(
        IntensityMethod, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workout_exercise', 'order')

    def volume(self):
        return self.weight * self.reps

    def __str__(self):
        return f"Set {self.order}: {self.weight}x{self.reps}"
