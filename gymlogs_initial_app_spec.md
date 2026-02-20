# Gymlogs – Initial Version Specification
## Stack: Django (API) + React (Frontend)

This document defines the complete steps and architecture required to generate the first working version of the Gymlogs application.

The project already contains:

backend/
  manage.py
  backend/ (settings module)

The goal is to implement:

1. Authentication (login via JWT)
2. Workout logging form
3. Multiple sets per workout
4. Storage in database (Django ORM)
5. API endpoint that returns a pandas-computed topset per date
6. React frontend with:
   - Login screen
   - Workout form
   - Graph screen with exercise filter
   - Plot: X = date, Y = topset volume (weight * reps)

No HTMX.
Django will act strictly as an API server.

---

# 1. Backend Setup (Django)

## Install Dependencies

Run inside `backend/`:

```bash
pip install django django djangorestframework djangorestframework-simplejwt pandas django-cors-headers
```

---

# 2. Django Configuration

## Update settings.py

Add to `INSTALLED_APPS`:

- rest_framework
- corsheaders
- workouts

Add to `MIDDLEWARE` (near the top):

- corsheaders.middleware.CorsMiddleware

Add the following configuration:

```python
CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}
```

---

# 3. Create App

```bash
python manage.py startapp workouts
```

---

# 4. Database Models

Create the following models in `workouts/models.py`:

## Exercise
- name (unique)

## Workout
- user (ForeignKey to User)
- date (DateField)
- exercise (ForeignKey to Exercise)
- notes (TextField, optional)
- created_at (DateTime auto)

## SetEntry
- workout (ForeignKey to Workout, related_name="sets")
- order (PositiveInteger)
- weight (FloatField)
- reps (PositiveInteger)
- reached_failure (BooleanField)
- intensity_method (choices: none, myoreps, dropset)

Add method:
- volume() → weight * reps

---

# 5. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

---

# 6. Authentication (JWT)

Use SimpleJWT.

Add to `backend/urls.py`:

```python
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns += [
    path("api/token/", TokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
]
```

---

# 7. API Endpoints

Use Django REST Framework.

## Required Endpoints

### 1. GET /api/exercises/
Returns list of exercises.

### 2. POST /api/workouts/
Creates workout with nested sets.

Payload example:

```json
{
  "date": "2026-02-20",
  "exercise": 1,
  "notes": "Felt strong",
  "sets": [
    {
      "order": 1,
      "weight": 100,
      "reps": 5,
      "reached_failure": true,
      "intensity_method": "none"
    },
    {
      "order": 2,
      "weight": 90,
      "reps": 8,
      "reached_failure": false,
      "intensity_method": "dropset"
    }
  ]
}
```

### 3. GET /api/topsets/?exercise_id=1

Returns:

```json
{
  "data": [
    {"date": "2026-02-01", "topset": 500},
    {"date": "2026-02-10", "topset": 540}
  ]
}
```

---

# 8. Topset Logic (MANDATORY)

Inside the API view:

1. Query all SetEntry objects for the authenticated user.
2. Filter by exercise if provided.
3. Build a pandas DataFrame with:
   - date
   - volume (weight * reps)
4. Group by date.
5. Compute max(volume) per date.
6. Sort by date ascending.
7. Return JSON.

Definition:
Topset = maximum(weight * reps) per workout date.

---

# 9. Protect All Endpoints

All endpoints except token obtain must require authentication.

Use:

```python
permission_classes = [IsAuthenticated]
```

---

# 10. Frontend (React)

Create folder:

frontend/

Inside:

```bash
npm create vite@latest frontend
cd frontend
npm install
npm install axios react-router-dom plotly.js react-plotly.js
```

---

# 11. React Structure

src/
  api/
  pages/
  components/
  App.jsx

---

# 12. React Pages

## 1. Login Page

Fields:
- username
- password

On submit:
POST to /api/token/
Store access token in localStorage.

Use Axios interceptor to attach:

Authorization: Bearer <token>

---

## 2. Workout Page

Form fields:
- Date
- Exercise (dropdown from /api/exercises/)
- Notes
- Sets array

Each set must include:
- weight
- reps
- reached_failure
- intensity_method

Button:
+ Add Set

Store sets in React state as an array.

On submit:
POST to /api/workouts/

After success:
Navigate to /graph

---

## 3. Graph Page

Elements:
- Exercise filter dropdown
- Plot

On exercise change:
Fetch:

/api/topsets/?exercise_id=<id>

Plot:

X axis → date  
Y axis → topset  

Use Plotly scatter with lines+markers.

---

# 13. Routing

Routes:

/login  
/workout  
/graph  

If no token:
Redirect to /login.

---

# 14. Initial Data

The agent must auto-create at least:

- Bench Press
- Squat
- Deadlift

Either via migration or startup script.

---

# 15. Deliverables

The agent must produce:

- Working Django backend
- Working React frontend
- Authentication functioning
- Workout submission functioning
- Graph rendering correctly
- Topset computed via pandas
- README with setup instructions

---

# 16. Definition of Done

The application is complete when:

1. A user logs in.
2. A workout with multiple sets is submitted.
3. The sets are persisted in the database.
4. The graph page correctly shows topset per date.
5. Filtering by exercise updates the graph.
6. No HTMX is used anywhere.
7. Django acts only as an API server.

If any implementation detail is ambiguous, choose the simplest correct approach and proceed without asking for clarification.

