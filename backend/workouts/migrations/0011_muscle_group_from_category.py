from django.db import migrations


def copy_category_to_muscle_group(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    for exercise in Exercise.objects.filter(category__isnull=False):
        exercise.muscle_group = exercise.category
        exercise.save()


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0010_exercise_category'),
    ]

    operations = [
        migrations.RunPython(copy_category_to_muscle_group, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='exercise',
            name='category',
        ),
    ]
