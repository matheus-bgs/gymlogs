from django.db import migrations


def apply_exercise_updates(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')

    # Rename 'Incline DB Press' → 'Incline Dumbbell Press'
    Exercise.objects.filter(name='Incline DB Press').update(
        name='Incline Dumbbell Press',
        name_pt='Supino Inclinado com Halteres',
    )

    # Add 'Overhead Dumbbell Press' if it doesn't exist yet
    Exercise.objects.get_or_create(
        name='Overhead Dumbbell Press',
        defaults={'name_pt': 'Desenvolvimento com Halteres'},
    )

    # Fix 'Overhead Press' PT label now that the two exercises are distinct
    Exercise.objects.filter(name='Overhead Press').update(
        name_pt='Desenvolvimento com Barra',
    )


def reverse_exercise_updates(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')

    Exercise.objects.filter(name='Incline Dumbbell Press').update(
        name='Incline DB Press',
        name_pt='Supino Inclinado com Halteres',
    )
    Exercise.objects.filter(name='Overhead Dumbbell Press').delete()
    Exercise.objects.filter(name='Overhead Press').update(
        name_pt='Desenvolvimento com Halteres',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0006_workout_plans'),
    ]

    operations = [
        migrations.RunPython(apply_exercise_updates, reverse_exercise_updates),
    ]
