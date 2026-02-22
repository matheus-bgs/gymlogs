from django.db import migrations

NEW_TRANSLATIONS = {
    'Bench Press': 'Supino Reto',
    'Barbell Row': 'Remada com Barra',
    'Deadlift': 'Levantamento Terra',
    'Dumbbell Curl': 'Rosca Direta',
    'Pull Up': 'Barra Fixa',
}


def backfill_new_translations(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    for exercise in Exercise.objects.filter(name__in=NEW_TRANSLATIONS.keys()):
        if not exercise.name_pt:
            exercise.name_pt = NEW_TRANSLATIONS[exercise.name]
            exercise.save(update_fields=['name_pt'])


def reverse_backfill(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    Exercise.objects.filter(
        name__in=NEW_TRANSLATIONS.keys()).update(name_pt=None)


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0004_exercise_name_pt'),
    ]

    operations = [
        migrations.RunPython(backfill_new_translations, reverse_backfill),
    ]
