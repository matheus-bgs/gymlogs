# Workout Card-List Redesign Plan

**Date:** 2026-03-14  
**Scope:** Replace the linear "next exercise" flow in `Workout.jsx` with a card-list where every exercise from the plan is visible simultaneously as collapsed cards.

---

## User Decisions

| Decision | Choice |
|---|---|
| Log trigger | "Log Exercise" button at bottom of each expanded card |
| Re-edit green card | Yes — reopening pre-populates sets; re-submitting deletes old record and posts new |
| Freeform (no plan) | Empty card list; user adds cards via exercise search |
| Remove logged card | Confirm prompt → delete backend record (WorkoutExercise + sets cascade) |
| Per-exercise timer | Resets to 0 on each log; elapsed value sent as `exercise_duration_seconds`. First card auto-expands on session start. After logging, collapse done card and auto-expand next unlogged card. If user manually expands another card, timer keeps running (attributed to next exercise they log). |
| Finish Workout | Persistent button, enabled once ≥1 card is logged |
| Notes | Single session-level notes field near the "Finish Workout" button |
| Exercise swap | Removed — user can delete a card and add the desired exercise instead |

---

## Phase 1 — Backend

### Step 1: Enhance `SessionProgressView` (views.py)

Currently returns `{logged_exercise_ids: [...]}`.  
**New response:**
```json
{
  "exercises": [
    {
      "exercise_id": 5,
      "workout_exercise_id": 42,
      "sets": [
        {"id": 101, "order": 1, "weight": 70.5, "reps": 8, "reached_failure": true, "intensity_method": "none"}
      ]
    }
  ]
}
```

Query: `WorkoutExercise.objects.filter(workout_session__user=user, workout_session__date=date, workout_session__plan_day_id=plan_day_id).prefetch_related('setentry_set')`

### Step 2: Add `WorkoutExerciseDeleteView` (views.py)

- `DELETE /api/workout-exercises/{we_id}/`
- Verify ownership: `workout_exercise.workout_session.user == request.user`
- Delete the `WorkoutExercise` record (SetEntry cascades via `on_delete=CASCADE`)
- Returns 204

### Step 3: Wire URL (urls.py)

```python
path('workout-exercises/<int:we_id>/', WorkoutExerciseDeleteView.as_view()),
```

---

## Phase 2 — Frontend Data Layer

### Step 4: Update `fetchSessionProgress` (queries.js)

Handle new response shape `{exercises: [...]}`.  
Return the exercises array directly.

### Step 5: Add `deleteWorkoutExercise(weId)` (queries.js)

`DELETE /api/workout-exercises/{weId}/` → returns 204.

---

## Phase 3 — `ExerciseCard` Sub-Component (Workout.jsx)

Inline sub-component reusing `SetCard` and `LastWorkoutPanel`.

**Card object shape:**
```js
{
  id: string,               // "plan-{planExId}" or "free-{uuid}"
  exercise: { id, name, name_pt, muscle_group },
  planExercise: { id, target_sets, reps_min, reps_max } | null,
  sets: [...],              // local editing state
  isLogged: bool,
  loggedSets: [...] | null, // sets returned from backend after logging
  workoutExerciseId: int | null,
  fieldErrors: [...]
}
```

**Visual states:**

| State | Appearance |
|---|---|
| Collapsed + unlogged | Gray card — name, muscle group, plan target, chevron |
| Expanded + unlogged | Full set-entry UI + "Log Exercise" button |
| Collapsed + logged | Green border/tint — name + set summary ("3 × 70 / 72.5 / 75 kg") |
| Expanded + logged | Sets pre-populated from `loggedSets`, "Re-log Exercise" button |

---

## Phase 4 — Workout.jsx Main Component Redesign

### New state

```js
const [date, setDate] = useState(today());
const [selectedPlanDayId, setSelectedPlanDayId] = useState(null);
const [dayLabel, setDayLabel] = useState('');
const [cardList, setCardList] = useState([]);
const [expandedCardId, setExpandedCardId] = useState(null);
const [sessionActive, setSessionActive] = useState(false);
const [sessionSeconds, setSessionSeconds] = useState(0);
const [perExSeconds, setPerExSeconds] = useState(0);
const sessionIntervalRef = useRef(null);
const [showSummary, setShowSummary] = useState(false);
const [sessionLog, setSessionLog] = useState([]);
const [sessionNotes, setSessionNotes] = useState('');
const [addExSearch, setAddExSearch] = useState('');
const [toast, setToast] = useState({ message: '', type: 'success' });
```

### Key handlers

| Handler | Behaviour |
|---|---|
| `buildCardList(planDay)` | Maps `planDay.exercises` → card objects with built sets from `target_sets` |
| `handleStartSession()` | `sessionActive=true`, auto-expand first unlogged card |
| `handleToggleCard(cardId)` | Toggle expansion — only one card open at a time |
| `handleLogExercise(cardId)` | Validate → if re-logging DELETE old first → POST → mark green, reset `perExSeconds`, collapse + advance to next |
| `handleRemoveCard(cardId)` | If logged: confirm + DELETE backend; else: splice from list |
| `handleAddExercise(exercise)` | Append new card with 3 default sets, `planExercise=null` |
| `handleFinishWorkout()` | Stop timer, show WorkoutSummary |

### Timer logic

Single `useEffect` on `sessionActive`: starts `setInterval` (+1 to both `sessionSeconds` and `perExSeconds` per tick). `perExSeconds` resets to 0 on each `handleLogExercise`. Its value at logging time is sent as `exercise_duration_seconds`.

### Resume logic

When `sessionProgress` query resolves, for each returned exercise find matching card by `exercise_id` and mark `isLogged=true`, `loggedSets=sets`, `workoutExerciseId=workout_exercise_id`.

---

## Phase 5 — i18n

New keys in `en.json` and `pt.json`:

| Key | English | Portuguese |
|---|---|---|
| `workout.logExercise` | "Log Exercise" | "Registrar Exercício" |
| `workout.relogExercise` | "Re-log Exercise" | "Reatualizar Exercício" |
| `workout.finishWorkout` | "Finish Workout" | "Finalizar Treino" |
| `workout.startWorkout` | "Start Workout" | "Iniciar Treino" |
| `workout.addExercise` | "Add Exercise" | "Adicionar Exercício" |
| `workout.removeCard` | "Remove" | "Remover" |
| `workout.confirmRemoveLogged` | "This exercise is already logged. Remove it and delete the data?" | "Este exercício já foi registrado. Remover e apagar os dados?" |
| `workout.exerciseAlreadyAdded` | "Exercise already in the list" | "Exercício já está na lista" |
| `workout.sessionNotes` | "Session Notes" | "Notas da Sessão" |

---

## Files Changed

| File | Change |
|---|---|
| `backend/workouts/views.py` | Enhance `SessionProgressView`; add `WorkoutExerciseDeleteView` |
| `backend/backend/urls.py` | Add DELETE route |
| `frontend/src/lib/queries.js` | Update `fetchSessionProgress`; add `deleteWorkoutExercise` |
| `frontend/src/pages/Workout.jsx` | Major redesign (keep `SetCard`, `LastWorkoutPanel`, helpers) |
| `frontend/src/i18n/en.json` | New translation keys |
| `frontend/src/i18n/pt.json` | New translation keys |

**`WorkoutSummary.jsx` — no changes needed.**

---

## Verification Checklist

- [ ] Plan mode: select day → cards appear → start → first opens → log → green → next opens → finish → summary correct
- [ ] Freeform: empty list → add exercises → log → finish → summary
- [ ] Resume: partial session → refresh → same day → logged cards pre-populated green
- [ ] Re-edit: reopen green card → change sets → re-log → DB reflects only new data
- [ ] Remove logged: confirm prompt → card gone → DB `WorkoutExercise` deleted
- [ ] Remove unlogged: no backend call, card removed
- [ ] Add freeform card mid-session → logs normally
- [ ] Per-exercise timer resets on each log; `exercise_duration_seconds` correct in DB
- [ ] Weight unit (kg/lbs) works in new card UI
- [ ] i18n: all new strings translate on language toggle
