"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from workouts.views import ExerciseListView, WorkoutCreateView, TopsetsView, LastWorkoutView, DebugDBView, RegisterView

urlpatterns = [
    path('api/debug-db/', DebugDBView.as_view()),
    path('api/register/', RegisterView.as_view()),
    path('admin/', admin.site.urls),
    path("api/token/", TokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/exercises/", ExerciseListView.as_view()),
    path("api/workouts/", WorkoutCreateView.as_view()),
    path("api/workouts/last/", LastWorkoutView.as_view()),
    path("api/topsets/", TopsetsView.as_view()),
    re_path(r'^.*', TemplateView.as_view(template_name='index.html')),
]
