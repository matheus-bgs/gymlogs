from django.db import migrations, models


PT_TRANSLATIONS = {
    # Chest / Push
    'Bench Press': 'Supino Reto',
    'Incline DB Press': 'Supino Inclinado com Halteres',
    'Cable Fly': 'Crucifixo no Cabo',
    # Back / Pull
    'Barbell Row': 'Remada com Barra',
    'T-Bar Row': 'Remada Curvada (Barra T)',
    'Close Grip Lat Pulldown': 'Puxada com Pegada Fechada',
    'Wide Grip Lat Pulldown': 'Puxada com Pegada Aberta',
    'Cable Row': 'Remada no Cabo',
    'Machine Row': 'Remada na Máquina',
    'One-Arm Cable Row': 'Remada Unilateral no Cabo',
    'Pull Up': 'Barra Fixa',
    # Arms
    'Triceps Pressdown': 'Tríceps Pulley',
    'Triceps Extension': 'Extensão de Tríceps',
    'Cable Curl': 'Rosca no Cabo',
    'Dumbbell Curl': 'Rosca Direta',
    # Shoulders / Rear Delt
    'Cable Lateral Raise': 'Elevação Lateral no Cabo',
    'Overhead Press': 'Desenvolvimento com Halteres',
    'Reverse Fly': 'Crucifixo Inverso',
    'Reverse Cable Fly': 'Crucifixo Inverso no Cabo',
    'Reverse Pec Deck': 'Crucifixo Inverso (Máquina)',
    # Compound / Full-body
    'Deadlift': 'Levantamento Terra',
    # Legs
    'Squat': 'Agachamento',
    'Seated Leg Curl': 'Flexão de Joelho Sentada',
    'Knee Extension': 'Extensão de Joelho',
    'Seated Leg Abduction': 'Abdução de Perna Sentada',
    'Calf Raise': 'Elevação de Panturrilha',
    'Stiff-Legged Deadlift': 'Levantamento Terra com Pernas Estendidas',
    'Hip Thrust': 'Elevação Pélvica',
}


def set_pt_translations(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    for exercise in Exercise.objects.all():
        if exercise.name in PT_TRANSLATIONS:
            exercise.name_pt = PT_TRANSLATIONS[exercise.name]
            exercise.save(update_fields=['name_pt'])


def reverse_pt_translations(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    Exercise.objects.all().update(name_pt=None)


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0003_consolidate_exercises'),
    ]

    operations = [
        migrations.AddField(
            model_name='exercise',
            name='name_pt',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RunPython(set_pt_translations, reverse_pt_translations),
    ]
