from django.contrib import admin
from .models import (
    Exercise, WorkoutPlan, PlanDay, PlanExercise,
    WorkoutSession, WorkoutExercise, IntensityMethod, SetEntry,
)

admin.site.register(Exercise)
admin.site.register(WorkoutPlan)
admin.site.register(PlanDay)
admin.site.register(PlanExercise)
admin.site.register(WorkoutSession)
admin.site.register(WorkoutExercise)
admin.site.register(IntensityMethod)
admin.site.register(SetEntry)

# Register your models here.
