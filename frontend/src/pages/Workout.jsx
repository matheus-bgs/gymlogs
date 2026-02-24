import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Calendar, Activity, FileText, X, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    queryKeys, fetchExercises, fetchLastWorkout, fetchActivePlan, fetchSessionProgress,
    saveWorkout, createExercise,
} from '../lib/queries';
import { exName } from '../lib/i18nUtils';
import WorkoutSummary from './WorkoutSummary';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const today = () => new Date().toISOString().split('T')[0];

const emptySet = (order = 1) => ({ order, weight: '', reps: '', reached_failure: false, intensity_method: 'none' });

const buildSets = (count) => Array.from({ length: count }, (_, i) => emptySet(i + 1));

// â”€â”€ Toast component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Toast({ message }) {
    if (!message) return null;
    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 px-5 py-3 bg-green-700 text-white rounded-2xl shadow-2xl font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> {message}
            </div>
        </div>
    );
}

// â”€â”€ Shared set row card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SetCard({ set, index, disabled, onSetChange, onRemove, canRemove, t, planHint }) {
    return (
        <div className={`group bg-gray-950 rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all flex flex-wrap items-end gap-4 relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="absolute -left-3 -top-3 w-8 h-8 bg-gray-800 text-gray-300 rounded-full flex items-center justify-center font-bold text-sm border border-gray-700 shadow-sm">
                {set.order}
            </div>
            {planHint && (
                <div className="w-full text-xs text-green-400/70 -mb-2">{planHint}</div>
            )}
            <div className="flex-1 min-w-[100px]">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('workout.weight')}</label>
                <input type="number" step="0.5" required
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    value={set.weight}
                    onChange={e => onSetChange(index, 'weight', parseFloat(e.target.value))}
                    placeholder="0.0"
                />
            </div>
            <div className="flex-1 min-w-[100px]">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('workout.reps')}</label>
                <input type="number" required
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all"
                    value={set.reps}
                    onChange={e => onSetChange(index, 'reps', parseInt(e.target.value))}
                    placeholder="0"
                />
            </div>
            <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('workout.intensityMethod')}</label>
                <select
                    className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all appearance-none"
                    value={set.intensity_method}
                    onChange={e => onSetChange(index, 'intensity_method', e.target.value)}
                >
                    <option value="none">{t('workout.standard')}</option>
                    <option value="myoreps">{t('workout.myoreps')}</option>
                    <option value="dropset">{t('workout.dropset')}</option>
                </select>
            </div>
            <div className="flex items-center h-[46px] px-2">
                <label className="flex items-center gap-3 cursor-pointer group/check">
                    <div className="relative flex items-center">
                        <input type="checkbox" className="peer sr-only"
                            checked={set.reached_failure}
                            onChange={e => onSetChange(index, 'reached_failure', e.target.checked)}
                        />
                        <div className="w-6 h-6 bg-gray-900 border-2 border-gray-700 rounded-md peer-checked:bg-red-500 peer-checked:border-red-500 transition-all flex items-center justify-center">
                            <svg className={`w-4 h-4 text-white ${set.reached_failure ? 'opacity-100' : 'opacity-0'} transition-opacity`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    <span className={`text-sm font-medium transition-colors ${set.reached_failure ? 'text-red-400' : 'text-gray-400 group-hover/check:text-gray-300'}`}>
                        {t('workout.failure')}
                    </span>
                </label>
            </div>
            {canRemove && (
                <button type="button" onClick={() => onRemove(index)}
                    className="h-[46px] px-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}

// â”€â”€ Last workout panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function LastWorkoutPanel({ exerciseId, t }) {
    const { data: lastWorkout = null, isLoading } = useQuery({
        queryKey: queryKeys.lastWorkout(exerciseId),
        queryFn: () => fetchLastWorkout(exerciseId),
        enabled: !!exerciseId,
        staleTime: 0,
    });

    if (!exerciseId) return null;

    return (
        <div className="pt-6 border-t border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" /> {t('workout.lastWorkout')}
            </h3>
            {isLoading ? (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                </div>
            ) : lastWorkout ? (
                <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800">
                    <span className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4" /> {lastWorkout.date}
                    </span>
                    {lastWorkout.notes && (
                        <p className="text-sm text-gray-300 mb-4 italic border-l-2 border-green-500 pl-3 py-1 bg-green-500/5 rounded-r-lg">
                            "{lastWorkout.notes}"
                        </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {lastWorkout.sets.map((s, idx) => (
                            <div key={idx} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 bg-gray-800 w-6 h-6 rounded-full flex items-center justify-center">{s.order}</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-white">{s.weight} <span className="text-xs text-gray-400 font-normal">kg</span> &times; {s.reps}</span>
                                    <div className="flex gap-1 mt-1">
                                        {s.intensity_method !== 'none' && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">{s.intensity_method}</span>
                                        )}
                                        {s.reached_failure && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">Failure</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800 text-center">
                    <p className="text-sm text-gray-500">{t('workout.noLastWorkout')}</p>
                </div>
            )}
        </div>
    );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Workout() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const pageTopRef = useRef(null);

    // â”€â”€ Shared form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [date, setDate] = useState(today());
    const [notes, setNotes] = useState('');
    const [sets, setSets] = useState([emptySet(1)]);

    // â”€â”€ Plan-driven state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [planDayId, setPlanDayId] = useState(null);
    const [currentExIndex, setCurrentExIndex] = useState(0);
    const [sessionLog, setSessionLog] = useState([]);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    // â”€â”€ Freeform state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [freeformMode, setFreeformMode] = useState(false);
    const [exercise, setExercise] = useState('');
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercises(),
        queryFn: fetchExercises,
        staleTime: 10 * 60 * 1000,
    });

    const { data: activePlan } = useQuery({
        queryKey: queryKeys.activePlan(),
        queryFn: fetchActivePlan,
        staleTime: 5 * 60 * 1000,
    });

    const hasPlan = !!activePlan && activePlan.days.length > 0;
    const inPlanMode = hasPlan && !freeformMode;

    const planDay = inPlanMode ? (activePlan.days.find(d => d.id === planDayId) ?? null) : null;
    const planExEntry = planDay ? (planDay.exercises[currentExIndex] ?? null) : null;

    const { data: loggedExerciseIds = [] } = useQuery({
        queryKey: queryKeys.sessionProgress(date, planDayId),
        queryFn: () => fetchSessionProgress(date, planDayId),
        enabled: inPlanMode && !!planDayId,
        staleTime: 0,
    });

    // Auto-set first plan day
    useEffect(() => {
        if (hasPlan && !planDayId) {
            setPlanDayId(activePlan.days[0].id);
        }
    }, [hasPlan, activePlan, planDayId]);

    // Resume from session progress when day/date changes
    useEffect(() => {
        if (!inPlanMode || !planDay || loggedExerciseIds === undefined) return;
        const loggedSet = new Set(loggedExerciseIds.map(Number));
        const resumeIdx = planDay.exercises.findIndex(pe => !loggedSet.has(pe.exercise.id));
        const idx = resumeIdx === -1 ? planDay.exercises.length : resumeIdx;
        setCurrentExIndex(idx);
        if (idx > 0 && idx < planDay.exercises.length) {
            showToast(t('workout.resumingSession'));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planDayId, loggedExerciseIds, date]);

    // Pre-populate sets from plan when exercise changes
    useEffect(() => {
        if (inPlanMode && planExEntry) {
            setSets(buildSets(planExEntry.target_sets));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inPlanMode, planExEntry?.id]);

    // Close freeform dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // â”€â”€ Toast helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const showToast = useCallback((message) => {
        setToast(message);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    // â”€â”€ Set helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleAddSet = () => setSets(prev => [...prev, emptySet(prev.length + 1)]);
    const handleRemoveSet = (idx) =>
        setSets(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
    const handleSetChange = (idx, field, value) =>
        setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });

    // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const createExerciseMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: (newEx) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exercises() });
            setExercise(newEx.id.toString());
            setIsCreatingExercise(false);
            setNewExerciseName('');
        },
        onError: () => alert(t('workout.createExerciseFailed')),
    });

    const saveWorkoutMutation = useMutation({
        mutationFn: saveWorkout,
        onSuccess: () => {
            if (inPlanMode && planExEntry) {
                const exerciseName = exName(planExEntry.exercise, i18n.language);
                const loggedSets = [...sets];

                queryClient.invalidateQueries({ queryKey: queryKeys.lastWorkout(planExEntry.exercise.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.topsets(planExEntry.exercise.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.exercisesWithData() });

                setSessionLog(prev => [...prev, { exerciseName, sets: loggedSets }]);
                showToast(t('workout.exerciseLogged', { name: exerciseName }));
                setNotes('');

                const nextIdx = currentExIndex + 1;
                if (nextIdx >= planDay.exercises.length) {
                    setSessionComplete(true);
                } else {
                    setCurrentExIndex(nextIdx);
                    pageTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                queryClient.invalidateQueries({ queryKey: queryKeys.lastWorkout(exercise) });
                queryClient.invalidateQueries({ queryKey: queryKeys.topsets(exercise) });
                queryClient.invalidateQueries({ queryKey: queryKeys.exercisesWithData() });
                navigate('/graph');
            }
        },
        onError: () => alert(t('workout.saveWorkoutFailed')),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (sets.length === 0) { alert(t('workout.needOneSet')); return; }
        if (inPlanMode && planExEntry) {
            saveWorkoutMutation.mutate({
                date,
                exercise: planExEntry.exercise.id,
                notes,
                sets,
                plan_day: planDayId,
                plan_exercise: planExEntry.id,
            });
        } else {
            if (!exercise) { alert(t('workout.needExercise')); return; }
            saveWorkoutMutation.mutate({ date, exercise, notes, sets });
        }
    };

    const handleReset = () => {
        setSessionComplete(false);
        setSessionLog([]);
        setCurrentExIndex(0);
        setNotes('');
        setSets([emptySet(1)]);
        setDate(today());
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
    };

    // â”€â”€ Session complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (sessionComplete) {
        return (
            <WorkoutSummary
                date={date}
                dayLabel={planDay?.label}
                sessionLog={sessionLog}
                onReset={handleReset}
            />
        );
    }

    const planHintText = (planExEntry && inPlanMode)
        ? t('plan.target', { sets: planExEntry.target_sets, min: planExEntry.reps_min, max: planExEntry.reps_max })
        : null;

    const currentExerciseId = inPlanMode
        ? (planExEntry ? String(planExEntry.exercise.id) : '')
        : exercise;

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div className="max-w-4xl mx-auto font-sans" ref={pageTopRef}>
            <Toast message={toast} />

            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-8 sm:p-10">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-12 w-12 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20">
                            <Activity className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{t('workout.title')}</h2>
                            <p className="text-sm text-gray-400">{t('workout.subtitle')}</p>
                        </div>
                        {hasPlan && (
                            <button
                                type="button"
                                onClick={() => { setFreeformMode(f => !f); setNotes(''); setSets([emptySet(1)]); setExercise(''); }}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                            >
                                {freeformMode ? (activePlan?.name ?? 'Use plan') : t('workout.logWithoutPlan')}
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* â”€â”€ Plan mode â”€â”€ */}
                        {inPlanMode && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                            <Calendar className="w-4 h-4 text-gray-500" /> {t('workout.date')}
                                        </label>
                                        <input type="date" required
                                            className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                            value={date}
                                            onChange={e => { setDate(e.target.value); setCurrentExIndex(0); setSessionLog([]); setSessionComplete(false); }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                            <Activity className="w-4 h-4 text-gray-500" /> {t('workout.selectDay')}
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {activePlan.days.map(day => (
                                                <button key={day.id} type="button"
                                                    onClick={() => {
                                                        if (planDayId !== day.id) {
                                                            setPlanDayId(day.id);
                                                            setCurrentExIndex(0);
                                                            setSessionLog([]);
                                                            setSessionComplete(false);
                                                            setSets([emptySet(1)]);
                                                        }
                                                    }}
                                                    className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                                                        ${planDayId === day.id
                                                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Progress + current exercise banner */}
                                {planDay && planDay.exercises.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-gray-500">
                                            <span>{currentExIndex}/{planDay.exercises.length} done</span>
                                            <span>{planDay.exercises.length - currentExIndex} remaining</span>
                                        </div>
                                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                                            <div
                                                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${(currentExIndex / planDay.exercises.length) * 100}%` }}
                                            />
                                        </div>
                                        {planExEntry && (
                                            <div className="bg-green-600/10 border border-green-500/20 rounded-2xl px-5 py-4">
                                                <p className="text-xs text-green-400/70 mb-1 font-medium uppercase tracking-wider">
                                                    {i18n.language === 'pt' ? 'ExercÃ­cio atual' : 'Current exercise'}
                                                </p>
                                                <p className="text-lg font-bold text-white">
                                                    {exName(planExEntry.exercise, i18n.language)}
                                                </p>
                                                <p className="text-sm text-gray-400 mt-0.5">{planHintText}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notes */}
                                {planDay && (
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                            <FileText className="w-4 h-4 text-gray-500" /> {t('workout.notes')}
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
                                            rows="2"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder={t('workout.notesPlaceholder')}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* â”€â”€ Freeform mode â”€â”€ */}
                        {!inPlanMode && (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                        <Calendar className="w-4 h-4 text-gray-500" /> {t('workout.date')}
                                    </label>
                                    <input type="date" required
                                        className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center justify-between text-sm font-medium text-gray-300">
                                        <span className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-gray-500" /> {t('workout.exercise')}
                                        </span>
                                        {!isCreatingExercise && (
                                            <button type="button" onClick={() => setIsCreatingExercise(true)}
                                                className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1">
                                                <Plus className="w-3 h-3" /> {t('workout.newExercise')}
                                            </button>
                                        )}
                                    </label>

                                    {isCreatingExercise ? (
                                        <div className="flex gap-2">
                                            <input type="text" autoFocus
                                                className="flex-1 px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                                placeholder={t('workout.exerciseNamePlaceholder')}
                                                value={newExerciseName}
                                                onChange={e => setNewExerciseName(e.target.value)}
                                            />
                                            <button type="button"
                                                onClick={() => newExerciseName.trim() && createExerciseMutation.mutate(newExerciseName.trim())}
                                                className="px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors">
                                                {t('workout.add')}
                                            </button>
                                            <button type="button"
                                                onClick={() => { setIsCreatingExercise(false); setNewExerciseName(''); }}
                                                className="px-3 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative" ref={dropdownRef}>
                                            <div
                                                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition-all cursor-pointer flex items-center justify-between"
                                                onClick={() => setIsDropdownOpen(o => !o)}
                                            >
                                                <span className={exercise ? 'text-white' : 'text-gray-500'}>
                                                    {exercise
                                                        ? exName(exercises.find(e => e.id === parseInt(exercise)), i18n.language)
                                                        : t('workout.selectExercise')}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>
                                            {isDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                                    <div className="p-2 border-b border-gray-800">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                            <input type="text" autoFocus
                                                                className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                                                placeholder={t('workout.searchExercises')}
                                                                value={searchQuery}
                                                                onChange={e => setSearchQuery(e.target.value)}
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        {exercises
                                                            .filter(ex => {
                                                                const q = searchQuery.toLowerCase();
                                                                return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
                                                            })
                                                            .sort((a, b) => exName(a, i18n.language).localeCompare(exName(b, i18n.language)))
                                                            .map(ex => (
                                                                <div key={ex.id}
                                                                    className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm ${exercise === ex.id.toString() ? 'bg-green-600/20 text-green-400' : 'text-gray-300'}`}
                                                                    onClick={() => { setExercise(ex.id.toString()); setIsDropdownOpen(false); setSearchQuery(''); }}
                                                                >
                                                                    {exName(ex, i18n.language)}
                                                                </div>
                                                            ))}
                                                        {exercises.filter(ex => {
                                                            const q = searchQuery.toLowerCase();
                                                            return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
                                                        }).length === 0 && (
                                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                                    {t('workout.noExercisesFound')}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="sm:col-span-2 space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                        <FileText className="w-4 h-4 text-gray-500" /> {t('workout.notes')}
                                    </label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        rows="2"
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder={t('workout.notesPlaceholder')}
                                        disabled={!exercise}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Last workout reference */}
                        <LastWorkoutPanel exerciseId={currentExerciseId} t={t} />

                        {/* Sets section â€” shown in plan mode only when a day+exercise is active */}
                        {(currentExerciseId || (!inPlanMode && !hasPlan) || freeformMode) && (
                            <div className="pt-6 border-t border-gray-800">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-white">{t('workout.workingSets')}</h3>
                                    <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                                        {t('workout.setsTotal', { count: sets.length })}
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    {sets.map((set, index) => (
                                        <SetCard
                                            key={index}
                                            set={set}
                                            index={index}
                                            disabled={!inPlanMode && !exercise}
                                            onSetChange={handleSetChange}
                                            onRemove={handleRemoveSet}
                                            canRemove={sets.length > 1}
                                            t={t}
                                            planHint={index === 0 && planHintText ? planHintText : null}
                                        />
                                    ))}
                                </div>
                                <button type="button" onClick={handleAddSet}
                                    className="mt-6 w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!inPlanMode && !exercise}
                                >
                                    <Plus className="w-5 h-5" /> {t('workout.addAnotherSet')}
                                </button>
                            </div>
                        )}

                        {/* Submit */}
                        <div className="pt-8 border-t border-gray-800">
                            <button
                                type="submit"
                                disabled={saveWorkoutMutation.isPending || (!inPlanMode && !exercise) || (inPlanMode && !planExEntry)}
                                className="w-full py-4 px-4 rounded-2xl shadow-lg shadow-green-600/20 text-base font-bold text-white bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saveWorkoutMutation.isPending ? t('workout.saving') : (
                                    <><Save className="w-5 h-5" /> {t('workout.saveWorkout')}</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Workout;
