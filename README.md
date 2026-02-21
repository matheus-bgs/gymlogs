# Gymlogs

A full-stack application for logging workouts and visualizing topset volumes over time.

## Tech Stack
- **Backend**: Django, Django REST Framework, SimpleJWT, Pandas
- **Frontend**: React, Vite, React Router, Plotly.js, Axios

## Setup Instructions

### Backend

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install django djangorestframework djangorestframework-simplejwt pandas django-cors-headers
   ```
3. Run migrations (this will also create initial exercises: Bench Press, Squat, Deadlift):
   ```bash
   python manage.py migrate
   ```
4. Create a superuser to log in:
   ```bash
   python manage.py createsuperuser
   ```
5. Start the development server:
   ```bash
   python manage.py runserver
   ```

### Frontend

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open the frontend application in your browser (usually `http://localhost:5173`).
2. Log in using the superuser credentials you created.
3. Log a workout with multiple sets.
4. Navigate to the Graph page to see your topset volume over time.
