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

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const queryKeys = {
    exercises: () => ['exercises'],
    exercisesWithData: () => ['exercisesWithData'],
    lastWorkout: (exerciseId) => ['lastWorkout', String(exerciseId)],
    topsets: (exerciseId) => ['topsets', String(exerciseId)],
    activePlan: () => ['plan'],
    sessionProgress: (date, planDayId) => ['sessionProgress', date, String(planDayId)],
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
    if (!exerciseId) return { x: [], topset: [], max_weight: [], has_intensity: [] };
    const { data } = await api.get(`topsets/?exercise_id=${exerciseId}`);
    const rows = data.data ?? [];
    return {
        x: rows.map(d => d.date),
        topset: rows.map(d => d.topset),
        max_weight: rows.map(d => d.max_weight),
        total_volume: rows.map(d => d.total_volume),
        has_intensity: rows.map(d => d.has_intensity),
    };
};

export const fetchActivePlan = async () => {
    const { data } = await api.get('plans/');
    return data.data ?? null;
};

export const fetchSessionProgress = async (date, planDayId) => {
    if (!date || !planDayId) return [];
    const { data } = await api.get(`workouts/session-progress/?date=${date}&plan_day_id=${planDayId}`);
    return data.data ?? [];
};

// ─── Mutator Functions ────────────────────────────────────────────────────────

export const saveWorkout = async (payload) => {
    const { data } = await api.post('workouts/', payload);
    return data;
};

export const createExercise = async (name) => {
    const { data } = await api.post('exercises/', { name });
    return data;
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
