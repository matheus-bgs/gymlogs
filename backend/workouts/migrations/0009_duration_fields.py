from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0008_userprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='workoutsession',
            name='duration_seconds',
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='workoutexercise',
            name='duration_seconds',
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
    ]
