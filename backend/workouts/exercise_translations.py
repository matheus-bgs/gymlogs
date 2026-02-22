# Master English → Portuguese exercise name dictionary.
# Used both by migrations (to backfill existing records) and by the Exercise
# model's save() to automatically populate name_pt when a known exercise is created.

EXERCISE_TRANSLATIONS_PT = {
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
