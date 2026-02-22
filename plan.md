# Plan: Plan Page + Plan-Driven Workout Flow

This adds a new `/plan` page where users define one active workout plan with named days (A, B, C…) and an ordered, drag-and-drop exercise list per day, each with a target set count and a rep range (min–max). The Workout page is then redesigned: it gains a day selector and a sequential exercise flow — after each submission a toast fires and the next exercise in the plan loads automatically. After the final exercise, a session summary screen is shown. Freeform logging without a plan remains available.

The change touches every layer: one new Django migration, four new backend endpoints, one new frontend page, a heavily reworked Workout page, a new summary screen, a drag-and-drop library, and new i18n keys in both languages.

---

## Steps

### 1 — Database: new migration `0006_workout_plans`

Create four schema changes in `backend/workouts/models.py`:

- **`WorkoutPlan`** — `user FK(User) CASCADE`, `name CharField(100)`, `is_active BooleanField default=False`, `created_at auto`. One active plan per user is enforced in the serializer (set `is_active` on this plan → clear `is_active` on all others for the user first).
- **`PlanDay`** — `plan FK(WorkoutPlan) CASCADE`, `label CharField(10)` (user-typed, e.g. "A"), `order PositiveIntegerField`. `unique_together = (plan, label)`.
- **`PlanExercise`** — `plan_day FK(PlanDay) CASCADE`, `exercise FK(Exercise) RESTRICT`, `order PositiveIntegerField`, `target_sets PositiveIntegerField`, `reps_min PositiveIntegerField`, `reps_max PositiveIntegerField`. `unique_together = (plan_day, order)`.
- **`WorkoutSession.plan_day`** — optional `FK(PlanDay) SET_NULL nullable` to record which plan day a session followed.
- **`WorkoutExercise.plan_exercise`** — optional `FK(PlanExercise) SET_NULL nullable` to later compare prescribed vs actual.

Generate migration `0006_workout_plans` with `makemigrations`.

---

### 2 — Backend: new serializers

In `backend/workouts/serializers.py`:

- **`PlanExerciseSerializer`** — `ModelSerializer` for `PlanExercise`; fields: `id, exercise, order, target_sets, reps_min, reps_max`. Nested `ExerciseSerializer` read-only on `exercise`.
- **`PlanDaySerializer`** — `ModelSerializer` for `PlanDay`; nested `PlanExerciseSerializer(many=True, read_only=True)` on `exercises`; fields: `id, label, order, exercises`.
- **`WorkoutPlanSerializer`** — `ModelSerializer` for `WorkoutPlan`; nested `PlanDaySerializer(many=True, read_only=True)`; fields: `id, name, is_active, days, created_at`. Write-side: `create()` sets `is_active=True` and clears `is_active` on any existing plan for that user.
- Update **`WorkoutSerializer`** — accept two new optional fields: `plan_day` (PrimaryKeyRelatedField `PlanDay`, nullable) and `plan_exercise` (PrimaryKeyRelatedField `PlanExercise`, nullable). Pass through to `WorkoutSession` and `WorkoutExercise` on create.

---

### 3 — Backend: new views and URL routes

In `backend/workouts/views.py`, add:

- **`WorkoutPlanView`** (`GET/POST /api/plans/`) — `GET`: return the requesting user's single active plan with all nested days + exercises, or `null`. `POST`: create plan via `WorkoutPlanSerializer`.
- **`PlanDetailView`** (`GET/PATCH/DELETE /api/plans/:id/`) — detail, partial update (name, `is_active`), delete.
- **`PlanDayView`** (`POST /api/plans/:id/days/`) — create a new day for the plan.
- **`PlanDayDetailView`** (`DELETE /api/plans/:id/days/:day_id/`) — delete a day.
- **`PlanExerciseView`** (`POST /api/plans/:id/days/:day_id/exercises/`) — add an exercise to a day.
- **`PlanExerciseDetailView`** (`PATCH/DELETE /api/plans/:id/days/:day_id/exercises/:ex_id/`) — update fields or delete.
- **`PlanExerciseReorderView`** (`POST /api/plans/:id/days/:day_id/exercises/reorder/`) — accepts `[{id, order}]` list and bulk-updates `order` fields. Returns updated list.
- **`SessionProgressView`** (`GET /api/workouts/session-progress/?date=X&plan_day_id=Y`) — returns the set of `exercise` IDs already logged under the matching `WorkoutSession` for that user+date. Used by the frontend to resume a partially-done session after a page refresh.

All views use `IsAuthenticated`. Register all new paths in `backend/backend/urls.py`.

---

### 4 — Frontend: install DnD library

Install `@dnd-kit/core` and `@dnd-kit/sortable` via `npm install` in the `frontend/` directory. These are the modern, Vite-compatible drag-and-drop primitives used to build the exercise reorder UI on the Plan page.

---

### 5 — Frontend: new `queries.js` entries

In `frontend/src/lib/queries.js`:

- `queryKeys.activePlan()` → `['plan']`
- `queryKeys.sessionProgress(date, planDayId)` → `['sessionProgress', date, String(planDayId)]`
- Fetchers: `fetchActivePlan`, `fetchSessionProgress`
- Mutators: `createPlan`, `updatePlan`, `deletePlan`, `createPlanDay`, `deletePlanDay`, `createPlanExercise`, `updatePlanExercise`, `deletePlanExercise`, `reorderPlanExercises`

---

### 6 — Frontend: new `Plan.jsx` page

New file `frontend/src/pages/Plan.jsx`:

- On mount, `useQuery(queryKeys.activePlan())` → fetch `GET /api/plans/`.
- If no plan exists: prompt to create one (name input + "Create Plan" button).
- Once a plan exists:
  - Display plan name (editable inline).
  - Day tabs (A, B, C…) — each tab is a `PlanDay`. A "＋ Add Day" button appends a new day (label input prompt).
  - Within each day tab: an ordered exercise list rendered with `@dnd-kit/sortable`. Each entry shows the locale-aware exercise name, target sets, reps min–max (all editable inline), and a delete button.
  - Below the list: an exercise search dropdown (reuse the same pattern as Workout/Graph) + target sets + reps min/reps max inputs + "Add Exercise" button.
  - On drag-end, fire `reorderPlanExercises` mutation and optimistically update the list.
  - Delete day button (with confirmation) → `deletePlanDay`.

---

### 7 — Frontend: rework `Workout.jsx`

The Workout page changes significantly. Current single-exercise form is replaced with a plan-aware sequential flow, while keeping a freeform fallback.

**New state:** `planDay` (selected `PlanDay` object | null), `currentExerciseIndex` (number), `sessionComplete` (bool).

**Plan-driven flow (when an active plan exists):**
1. Step 1 — Date + Day selector: top of the page shows date picker + day tab picker (A, B, C…). A small "Log without plan" link drops to freeform mode.
2. After selecting a date+day, `useQuery(queryKeys.sessionProgress(date, planDay.id))` fires to determine how many exercises have already been logged for that session today (handles page-refresh resumption). `currentExerciseIndex` is initialized to the first un-logged exercise index.
3. The form shows the *current* exercise name (read-only, derived from `planDay.exercises[currentExerciseIndex]`) and pre-populates a set count matching `target_sets` and displays a "Target: X sets of Y–Z reps" hint below each set row. Weight and reps remain free-input.
4. The "last workout" reference panel still works (unchanged `lastWorkout` query, just auto-supplied exercise id).
5. On submit success: show an in-page toast ("Squat logged ✓"). Clear sets back to one empty row. Increment `currentExerciseIndex`. Scroll to top of page. Next exercise loads.
6. When `currentExerciseIndex === planDay.exercises.length`: set `sessionComplete = true`.
7. When `sessionComplete` is true: render the **Session Summary** component instead of the form.

**Freeform mode (unchanged UX):**
- Exercise dropdown, free date, free notes, free sets — identical to today's behavior.
- Triggered by choosing "Log without plan" link or when no active plan exists.

---

### 8 — Frontend: Session Summary component

Inline component (or `WorkoutSummary.jsx`) rendered at the end of a plan-driven session. Shows:

- Date, plan day label (e.g., "Workout A").
- List of exercises with the sets logged (pulled from local state accumulated during the session).
- "View Progress" button → navigates to `/graph`.
- "Log Another Day" button → resets state and returns to the date+day selector.

No new API call needed — the data is already in local state from the sequential submissions.

---

### 9 — Frontend: update `App.jsx` and `Layout`

In `frontend/src/App.jsx`:
- Add `import Plan from './pages/Plan'`.
- Add `<Route path="/plan" element={<PrivateRoute><Layout><Plan /></Layout></PrivateRoute>} />`.

In `Layout` (inside `App.jsx`):
- Add a nav link for `/plan` using the `nav.plan` i18n key.

---

### 10 — i18n: add all new translation keys

In `frontend/src/i18n/en.json` and `frontend/src/i18n/pt.json`:

- `nav.plan` — "My Plan" / "Meu Plano"
- New top-level `plan` namespace: `title`, `subtitle`, `noPlan`, `createPlan`, `planNamePlaceholder`, `addDay`, `dayLabel`, `addExercise`, `targetSets`, `repsMin`, `repsMax`, `target` (hint text "Target: X sets of Y–Z reps"), `saveReorder`, `deleteDayConfirm`, `createPlanFailed`, `noExercisesInDay`
- New `workout` keys: `selectDay`, `logWithoutPlan`, `nextExercise`, `sessionComplete`, `sessionSummaryTitle`, `viewProgress`, `logAnotherDay`, `exerciseLogged` (toast text), `resumingSession` (toast text when resuming a partial session)

---

### 11 — Register new models in `admin.py`

In `backend/workouts/admin.py`, register `WorkoutPlan`, `PlanDay`, `PlanExercise` with `admin.site.register()` so they're visible in the Django admin panel for debugging.

---

## Verification

- **Backend unit**: run existing `backend/workouts/tests.py` (currently minimal) — extend with tests for `WorkoutPlanSerializer.create()` ensuring the old active plan is deactivated.
- **Migration check**: `python manage.py migrate --check` and `showmigrations` to confirm `0006` applies cleanly.
- **Plan CRUD**: create a plan with two days and several exercises; verify nested GET returns full structure.
- **Sequential flow**: log all exercises for a day in the UI; confirm toast appears after each, the next exercise auto-loads, and the summary screen appears at the end.
- **Resume after refresh**: log 2 of 7 exercises, refresh, confirm `sessionProgress` endpoint returns the 2 already-done exercises and the UI resumes at exercise 3.
- **Freeform mode**: click "Log without plan"; confirm the UI looks and behaves exactly as it does today.
- **Drag-and-drop reorder**: reorder exercises in the Plan page; confirm DB `order` field updates and the Workout page respects the new order.
- **i18n**: toggle to PT; confirm all new strings render correctly on both Plan and Workout pages.

---

## Decisions

- **Single active plan** — one plan per user marked `is_active`; switching plans clears the flag on the old one.
- **Freeform fallback** — "Log without plan" escape hatch preserved; no regressions for users without a plan.
- **Session summary instead of Graph redirect** — end-of-session shows a summary with a "View Progress" shortcut.
- **`@dnd-kit`** for drag-and-drop — chosen over `react-beautiful-dnd` (unmaintained) for Vite/React 19 compatibility.
- **`sessionProgress` endpoint** — lets the frontend resume a partial session correctly after a page refresh without depending on fragile local state.
- **Optional FKs on `WorkoutSession.plan_day` and `WorkoutExercise.plan_exercise`** — preserves all historical data and lets freeform sessions coexist with plan-driven ones cleanly.