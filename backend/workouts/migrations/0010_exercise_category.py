from django.db import migrations, models

EXERCISE_CATEGORIES = {
    'Barbell Row': 'back',
    'Bench Press': 'chest',
    'Cable Curl': 'biceps',
    'Cable Fly': 'chest',
    'Cable Lateral Raise': 'deltoids',
    'Cable Row': 'back',
    'Calf Raise': 'calves',
    'Close Grip Lat Pulldown': 'back',
    'Deadlift': 'posterior',
    'Dumbbell Curl': 'biceps',
    'Hip Thrust': 'glutes',
    'Incline Dumbbell Press': 'chest',
    'Knee Extension': 'quadriceps',
    'Leg Press': 'quadriceps',
    'Machine Row': 'back',
    'One-Arm Cable Row': 'back',
    'Overhead Dumbbell Press': 'deltoids',
    'Overhead Press': 'deltoids',
    'Pull Up': 'back',
    'Reverse Cable Fly': 'deltoids',
    'Reverse Fly': 'deltoids',
    'Reverse Pec Deck': 'deltoids',
    'Seated Leg Abduction': 'glutes',
    'Seated Leg Curl': 'hamstrings',
    'Squat': 'quadriceps',
    'Stiff-Legged Deadlift': 'hamstrings',
    'T-Bar Row': 'back',
    'Triceps Extension': 'triceps',
    'Triceps Pressdown': 'triceps',
    'Wide Grip Lat Pulldown': 'back',
}


def backfill_categories(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    for exercise in Exercise.objects.all():
        if exercise.name in EXERCISE_CATEGORIES:
            exercise.category = EXERCISE_CATEGORIES[exercise.name]
            exercise.save()


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0009_duration_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='category',
            field=models.CharField(blank=True, db_index=True, max_length=100, null=True),
        ),
        migrations.RunPython(backfill_categories, migrations.RunPython.noop),
    ]
