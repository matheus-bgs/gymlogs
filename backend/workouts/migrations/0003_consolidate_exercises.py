from django.db import migrations

def consolidate_exercises(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    WorkoutExercise = apps.get_model('workouts', 'WorkoutExercise')

    MAPPING = {
        'Calve raise': 'Calf Raise',
        'Incline DB press': 'Incline DB Press',
        'Cable flye': 'Cable Fly',
        'Triceps extension/pressdown': 'Triceps Pressdown',
        'Triceps pressdown': 'Triceps Pressdown',
        'Tricep Extension': 'Triceps Extension',
        'Wide grip lat pulldown 35,': 'Wide Grip Lat Pulldown',
        'Reverse cable flye': 'Reverse Cable Fly',
        'Reverse cable fly': 'Reverse Cable Fly',
        'Reverse fly': 'Reverse Fly',
        'Reverse pec deck': 'Reverse Pec Deck',
        'Stiff': 'Stiff-Legged Deadlift',
        'T-bar row': 'T-Bar Row',
        'One arm cable row': 'One-Arm Cable Row',
    }

    for exercise in Exercise.objects.all():
        old_name = exercise.name
        
        if old_name in MAPPING:
            new_name = MAPPING[old_name]
        else:
            new_name = old_name.title()
            new_name = new_name.replace('Db', 'DB')

        if old_name != new_name:
            existing_new_exercise = Exercise.objects.filter(name=new_name).first()
            
            if existing_new_exercise and existing_new_exercise.id != exercise.id:
                WorkoutExercise.objects.filter(exercise=exercise).update(exercise=existing_new_exercise)
                exercise.delete()
            else:
                exercise.name = new_name
                exercise.save()

def reverse_consolidation(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0002_auto_20260221_1706'),
    ]

    operations = [
        migrations.RunPython(consolidate_exercises, reverse_consolidation),
    ]
