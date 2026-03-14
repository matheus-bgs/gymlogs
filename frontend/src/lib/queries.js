/**
 * Centralized query keys and fetcher functions for TanStack Query.
 *
 * Query key structure keeps cache entries predictable and easy to invalidate:
 *   ['exercises']                        → full exercise list
 *   ['lastWorkout', exerciseId]          → most recent workout for one exercise
 *   ['topsets', exerciseId]              → topset/max-weight history for one exercise
 *   ['plan']                             → the user's active plan (with days + exercises)
 *   ['sessionProgress', date, planDayId] → exercise IDs already logged for a session
 */

import api from '../api/axios';

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/**
 * Decodes the stored JWT access token and returns the current user's ID.
 * Uses the standard `user_id` claim (Django SimpleJWT default) with a fallback
 * to `sub`. Returns null when no token is present or decoding fails.
 * No network request is made — this is a local base64 decode.
 */
export const getCurrentUserId = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id ?? payload.sub ?? null;
    } catch {
        return null;
    }
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
    // exercises is the shared global catalog — not user-scoped
    exercises: () => ['exercises'],
    // everything below is user-scoped: the userId is embedded so that a second
    // user logging in within the same tab never hits the previous user's cache
    exercisesWithData: () => ['exercisesWithData', getCurrentUserId()],
    lastWorkout: (exerciseId) => ['lastWorkout', String(exerciseId), getCurrentUserId()],
    topsets: (exerciseId) => ['topsets', String(exerciseId), getCurrentUserId()],
    activePlan: () => ['plan', getCurrentUserId()],
    sessionProgress: (date, planDayId) => ['sessionProgress', date, String(planDayId), getCurrentUserId()],
    profile: () => ['profile', getCurrentUserId()],
    history: () => ['history', getCurrentUserId()],
    weight: () => ['weight', getCurrentUserId()],
    weightHistory: () => ['weightHistory', getCurrentUserId()],
    dashboardSummary: (days) => ['dashboardSummary', days, getCurrentUserId()],
    volumeByMuscle: (days) => ['volumeByMuscle', days, getCurrentUserId()],
    trainingCalendar: () => ['trainingCalendar', getCurrentUserId()],
};

// ─── Fetcher Functions ────────────────────────────────────────────────────────

export const fetchExercises = async () => {
    const { data } = await api.get('exercises/');
    return data.sort((a, b) => a.name.localeCompare(b.name));
};

export const fetchExercisesWithData = async () => {
    const { data } = await api.get('exercises/?with_data=true');
    return data.sort((a, b) => a.name.localeCompare(b.name));
};

export const fetchLastWorkout = async (exerciseId) => {
    if (!exerciseId) return null;
    const { data } = await api.get(`workouts/last/?exercise_id=${exerciseId}`);
    return data.data ?? null;
};

export const fetchTopsets = async (exerciseId) => {
    if (!exerciseId) return { x: [], topset: [], max_weight: [], has_intensity: [], est_1rm: [] };
    const { data } = await api.get(`topsets/?exercise_id=${exerciseId}`);
    const rows = data.data ?? [];
    return {
        x: rows.map(d => d.date),
        topset: rows.map(d => d.topset),
        max_weight: rows.map(d => d.max_weight),
        total_volume: rows.map(d => d.total_volume),
        has_intensity: rows.map(d => d.has_intensity),
        est_1rm: rows.map(d => d.est_1rm),
    };
};

export const fetchActivePlan = async () => {
    const { data } = await api.get('plans/');
    return data.data ?? null;
};

export const fetchSessionProgress = async (date, planDayId) => {
    if (!date || !planDayId) return [];
    const { data } = await api.get(`workouts/session-progress/?date=${date}&plan_day_id=${planDayId}`);
    // data.data is now an array of { exercise_id, workout_exercise_id, sets[] }
    return data.data ?? [];
};

export const deleteWorkoutExercise = async (weId) => {
    await api.delete(`workout-exercises/${weId}/`);
};

export const fetchProfile = async () => {
    const { data } = await api.get('profile/');
    return data.data ?? { weight_unit: 'kg' };
};

export const fetchHistory = async () => {
    const { data } = await api.get('workouts/history/');
    return data.data ?? [];
};

// ─── Mutator Functions ────────────────────────────────────────────────────────

export const saveWorkout = async (payload) => {
    const { _meta, ...body } = payload;  // strip frontend-only metadata
    const { data } = await api.post('workouts/', body);
    return data;
};

export const createExercise = async (name) => {
    const { data } = await api.post('exercises/', { name });
    return data;
};

export const updateProfile = async (fields) => {
    const { data } = await api.patch('profile/', fields);
    return data.data;
};

export const updateSet = async ({ setId, weight, reps }) => {
    const { data } = await api.patch(`sets/${setId}/`, { weight, reps });
    return data.data;
};

export const fetchWeight = async () => {
    const { data } = await api.get('weight/');
    return data.data ?? { today: null, last: null };
};

export const saveWeight = async ({ weight, date }) => {
    const { data } = await api.post('weight/', { weight, date });
    return data.data;
};

export const createPlan = async ({ name }) => {
    const { data } = await api.post('plans/', { name });
    return data.data;
};

export const updatePlan = async ({ id, ...fields }) => {
    const { data } = await api.patch(`plans/${id}/`, fields);
    return data.data;
};

export const deletePlan = async (id) => {
    await api.delete(`plans/${id}/`);
};

export const createPlanDay = async ({ planId, label }) => {
    const { data } = await api.post(`plans/${planId}/days/`, { label });
    return data.data;
};

export const deletePlanDay = async ({ planId, dayId }) => {
    await api.delete(`plans/${planId}/days/${dayId}/`);
};

export const createPlanExercise = async ({ planId, dayId, exercise_id, target_sets, reps_min, reps_max }) => {
    const { data } = await api.post(`plans/${planId}/days/${dayId}/exercises/`, {
        exercise_id, target_sets, reps_min, reps_max,
    });
    return data.data;
};

export const updatePlanExercise = async ({ planId, dayId, exId, ...fields }) => {
    const { data } = await api.patch(`plans/${planId}/days/${dayId}/exercises/${exId}/`, fields);
    return data.data;
};

export const deletePlanExercise = async ({ planId, dayId, exId }) => {
    await api.delete(`plans/${planId}/days/${dayId}/exercises/${exId}/`);
};

export const reorderPlanExercises = async ({ planId, dayId, items }) => {
    const { data } = await api.post(`plans/${planId}/days/${dayId}/exercises/reorder/`, items);
    return data.data;
};

// ─── Dashboard Fetchers ───────────────────────────────────────────────────────

export const fetchWeightHistory = async () => {
    const { data } = await api.get('weight/history/');
    return data.data ?? [];
};

export const fetchDashboardSummary = async (days = 30) => {
    const { data } = await api.get(`dashboard/summary/?days=${days}`);
    return data.data ?? {};
};

export const fetchVolumeByMuscle = async (days = 30) => {
    const { data } = await api.get(`dashboard/volume-by-muscle/?days=${days}`);
    return data.data ?? { by_muscle: [], by_day: [] };
};

export const fetchTrainingCalendar = async () => {
    const { data } = await api.get('dashboard/training-calendar/');
    return data.data ?? [];
};
