import datetime
from django.db import migrations


WEIGHT_DATA = [
    ('2026-02-20', 76.250),
    ('2026-02-21', 76.650),
    ('2026-02-22', 76.050),
    ('2026-02-23', 77.250),
    ('2026-02-24', 77.550),
    ('2026-02-25', 76.750),
    ('2026-02-26', 77.100),
    ('2026-02-27', 77.200),
    ('2026-02-28', 76.850),
    ('2026-03-01', 77.000),
    ('2026-03-02', 77.100),
    ('2026-03-03', 77.300),
    ('2026-03-04', 77.150),
    ('2026-03-05', 77.100),
    ('2026-03-06', 77.650),
    ('2026-03-07', 78.300),
]


def seed_weights(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    BodyWeightEntry = apps.get_model('workouts', 'BodyWeightEntry')

    try:
        user = User.objects.get(username='admin')
    except User.DoesNotExist:
        return  # skip silently if user doesn't exist

    for date_str, weight in WEIGHT_DATA:
        BodyWeightEntry.objects.update_or_create(
            user=user,
            date=datetime.date.fromisoformat(date_str),
            defaults={'weight': weight},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0012_bodyweightentry'),
    ]

    operations = [
        migrations.RunPython(seed_weights, migrations.RunPython.noop),
    ]
