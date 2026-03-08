import datetime
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from .exercise_translations import EXERCISE_TRANSLATIONS_PT


class WorkoutPlan(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='plans', db_index=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class PlanDay(models.Model):
    plan = models.ForeignKey(
        WorkoutPlan, on_delete=models.CASCADE, related_name='days', db_index=True)
    label = models.CharField(max_length=10)  # e.g. "A", "B", "C"
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('plan', 'label')
        ordering = ['order']

    def __str__(self):
        return f"{self.plan.name} - Day {self.label}"


class PlanExercise(models.Model):
    plan_day = models.ForeignKey(
        PlanDay, on_delete=models.CASCADE, related_name='exercises', db_index=True)
    exercise = models.ForeignKey(
        'Exercise', on_delete=models.RESTRICT, db_index=True)
    order = models.PositiveIntegerField(default=0)
    target_sets = models.PositiveIntegerField(default=3)
    reps_min = models.PositiveIntegerField(default=6)
    reps_max = models.PositiveIntegerField(default=12)

    class Meta:
        unique_together = ('plan_day', 'order')
        ordering = ['order']

    def __str__(self):
        return f"{self.plan_day} - {self.exercise.name}"


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
    plan_day = models.ForeignKey(
        PlanDay, on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
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
    plan_exercise = models.ForeignKey(
        PlanExercise, on_delete=models.SET_NULL, null=True, blank=True, related_name='logged_exercises')
    order = models.PositiveIntegerField()
    notes = models.TextField(blank=True, null=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
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


# ---------------------------------------------------------------------------
# User profile (weight unit preference)
# ---------------------------------------------------------------------------

class UserProfile(models.Model):
    WEIGHT_UNIT_CHOICES = [('kg', 'kg'), ('lbs', 'lbs')]
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='profile')
    weight_unit = models.CharField(
        max_length=3, choices=WEIGHT_UNIT_CHOICES, default='kg')

    def __str__(self):
        return f"{self.user.username} profile"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


# ---------------------------------------------------------------------------
# Body weight tracking
# ---------------------------------------------------------------------------

class BodyWeightEntry(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='weight_entries', db_index=True)
    date = models.DateField(default=datetime.date.today, db_index=True)
    weight = models.FloatField()  # always stored in kg

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} - {self.date}: {self.weight} kg"
