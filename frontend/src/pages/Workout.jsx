import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Calendar, Activity, FileText, X, Search, ChevronDown, CheckCircle2, RefreshCw, Play, Square, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    queryKeys, fetchExercises, fetchLastWorkout, fetchActivePlan, fetchSessionProgress,
    fetchProfile, saveWorkout, createExercise,
} from '../lib/queries';
import { exName } from '../lib/i18nUtils';
import WorkoutSummary from './WorkoutSummary';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const today = () => new Date().toISOString().split('T')[0];

const emptySet = (order = 1) => ({ order, weight: '', reps: '', reached_failure: false, intensity_method: 'none' });

const buildSets = (count) => Array.from({ length: count }, (_, i) => emptySet(i + 1));

// â”€â”€ Toast component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const formatMmSs = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

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

function SetCard({ set, index, disabled, onSetChange, onSetBlur, onRemove, canRemove, t, planHint, weightUnit, fieldErrors }) {
    const unit = weightUnit || 'kg';
    const cardCls = 'group bg-gray-950 rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all flex flex-wrap items-end gap-4 relative' + (disabled ? ' opacity-50 pointer-events-none' : '');
    return (
        <div className={cardCls}>
            <div className="absolute -left-3 -top-3 w-8 h-8 bg-gray-800 text-gray-300 rounded-full flex items-center justify-center font-bold text-sm border border-gray-700 shadow-sm">
                {set.order}
            </div>
            {planHint && (
                <div className="w-full text-xs text-green-400/70 -mb-2">{planHint}</div>
            )}
            <div className="flex-1 min-w-[100px]">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    {t('workout.weight')} <span className="text-green-400/70">({unit})</span>
                </label>
                <input type="text" inputMode="decimal" required
                    className={'w-full px-4 py-2.5 bg-gray-900 border rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all ' + (fieldErrors?.weight ? 'border-red-500' : 'border-gray-700')}
                    value={set.weight}
                    onChange={e => onSetChange(index, 'weight', e.target.value)}
                    onBlur={() => onSetBlur(index, 'weight')}
                    placeholder="0.0"
                />
                {fieldErrors?.weight && (
                    <p className="text-xs text-red-400 mt-1">{t('workout.invalidWeight')}</p>
                )}
            </div>
            <div className="flex-1 min-w-[100px]">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('workout.reps')}</label>
                <input type="text" inputMode="numeric" required
                    className={'w-full px-4 py-2.5 bg-gray-900 border rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all ' + (fieldErrors?.reps ? 'border-red-500' : 'border-gray-700')}
                    value={set.reps}
                    onChange={e => onSetChange(index, 'reps', e.target.value)}
                    onBlur={() => onSetBlur(index, 'reps')}
                    placeholder="0"
                />
                {fieldErrors?.reps && (
                    <p className="text-xs text-red-400 mt-1">{t('workout.invalidReps')}</p>
                )}
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
                            <svg className={'w-4 h-4 text-white transition-opacity ' + (set.reached_failure ? 'opacity-100' : 'opacity-0')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>
                    <span className={'text-sm font-medium transition-colors ' + (set.reached_failure ? 'text-red-400' : 'text-gray-400 group-hover/check:text-gray-300')}>
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

function LastWorkoutPanel({ exerciseId, t, weightUnit }) {
    const unit = weightUnit || 'kg';
    const displayW = (kg) => unit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(2)) : kg;
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
                                    <span className="text-sm font-bold text-white">{displayW(s.weight)} <span className="text-xs text-gray-400 font-normal">{unit}</span> &times; {s.reps}</span>
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

    // ── Exercise swap + validation state ─────────────────────────────────────
    const [overrideExercise, setOverrideExercise] = useState(null); // exercise object
    const [isSwapOpen, setIsSwapOpen] = useState(false);
    const [swapSearchQuery, setSwapSearchQuery] = useState('');
    const [setFieldErrors, setSetFieldErrors] = useState({}); // { [idx]: { weight, reps } }
    // Stopwatch state (restored from localStorage for refresh recovery)
    const [timerRunning, setTimerRunning] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gym_timer'))?.running ?? false; } catch { return false; }
    });
    const [sessionStartTs, setSessionStartTs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gym_timer'))?.sessionStartTs ?? null; } catch { return null; }
    });
    const [exerciseStartTs, setExerciseStartTs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gym_timer'))?.exerciseStartTs ?? null; } catch { return null; }
    });
    const [now, setNow] = useState(Date.now());
    const [sessionDurationFinal, setSessionDurationFinal] = useState(null);
    const pendingDurationRef = useRef(null);

    // â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercises(),
        queryFn: fetchExercises,
        staleTime: 10 * 60 * 1000,
    });

    const { data: profile = { weight_unit: 'kg' } } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
        staleTime: 5 * 60 * 1000,
    });
    const weightUnit = profile.weight_unit;

    // Convert value from display unit to kg for API storage
    const inputWeightToKg = (val) => {
        const num = parseFloat(String(val).replace(',', '.'));
        return weightUnit === 'lbs' ? parseFloat((num / 2.20462).toFixed(4)) : num;
    };

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

    // Auto-set next plan day using last logged day for plan-order awareness
    useEffect(() => {
        if (hasPlan && !planDayId) {
            const days = activePlan.days;
            const lastDayId = activePlan.last_day_id;
            if (lastDayId) {
                const lastDayIdx = days.findIndex(d => d.id === lastDayId);
                const nextIdx = lastDayIdx !== -1 ? (lastDayIdx + 1) % days.length : 0;
                setPlanDayId(days[nextIdx].id);
            } else {
                setPlanDayId(days[0].id);
            }
        }
    }, [hasPlan, activePlan, planDayId]);

    // Clear exercise override when advancing to next exercise
    useEffect(() => {
        setOverrideExercise(null);
        setIsSwapOpen(false);
        setSwapSearchQuery('');
    }, [currentExIndex]);

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

    // Persist timer state to localStorage whenever it changes
    useEffect(() => {
        if (timerRunning && sessionStartTs && exerciseStartTs) {
            localStorage.setItem('gym_timer', JSON.stringify({ running: true, sessionStartTs, exerciseStartTs }));
        }
    }, [timerRunning, sessionStartTs, exerciseStartTs]);

    // Tick every second while running
    useEffect(() => {
        if (!timerRunning) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [timerRunning]);

    // â”€â”€ Toast helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const showToast = useCallback((message) => {
        setToast(message);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    // â”€â”€ Set helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Timer helpers
    const handleStartTimer = () => {
        const ts = Date.now();
        setTimerRunning(true);
        setSessionStartTs(ts);
        setExerciseStartTs(ts);
        setNow(ts);
    };

    const handleStopTimer = () => {
        setTimerRunning(false);
        setSessionStartTs(null);
        setExerciseStartTs(null);
        localStorage.removeItem('gym_timer');
    };

    // Derived tick values (seconds)
    const exerciseSecs = (timerRunning && exerciseStartTs) ? Math.floor((now - exerciseStartTs) / 1000) : 0;
    const sessionSecs  = (timerRunning && sessionStartTs)  ? Math.floor((now - sessionStartTs)  / 1000) : 0;

    const handleAddSet = () => setSets(prev => [...prev, emptySet(prev.length + 1)]);
    const handleRemoveSet = (idx) =>
        setSets(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
    const handleSetChange = (idx, field, value) =>
        setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });

    const handleSetBlur = (idx, field) => {
        const rawVal = sets[idx]?.[field];
        if (field === 'weight') {
            const normalized = String(rawVal ?? '').replace(',', '.');
            const num = parseFloat(normalized);
            const invalid = isNaN(num) || num < 0;
            setSetFieldErrors(prev => ({ ...prev, [idx]: { ...prev[idx], weight: invalid } }));
            if (!invalid) setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], weight: normalized }; return n; });
        } else if (field === 'reps') {
            const num = parseInt(String(rawVal ?? ''), 10);
            const invalid = isNaN(num) || num <= 0;
            setSetFieldErrors(prev => ({ ...prev, [idx]: { ...prev[idx], reps: invalid } }));
            if (!invalid) setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], reps: String(num) }; return n; });
        }
    };

    const hasValidationErrors = Object.values(setFieldErrors).some(e => e && (e.weight || e.reps));

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
        onSuccess: (response) => {
            if (inPlanMode && planExEntry) {
                const activeExercise = overrideExercise ?? planExEntry.exercise;
                const exerciseName = exName(activeExercise, i18n.language);
                // Prefer response.sets (has DB ids) for post-session editing; fall back to local state
                const loggedSets = response?.sets?.length ? response.sets : [...sets];
                const { exerciseDur } = pendingDurationRef.current ?? {};

                queryClient.invalidateQueries({ queryKey: queryKeys.lastWorkout(activeExercise.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.topsets(activeExercise.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
                queryClient.invalidateQueries({ queryKey: queryKeys.exercisesWithData() });

                setSessionLog(prev => [...prev, { exerciseName, sets: loggedSets, duration: exerciseDur }]);
                showToast(t('workout.exerciseLogged', { name: exerciseName }));
                setNotes('');

                const nextIdx = currentExIndex + 1;
                if (nextIdx >= planDay.exercises.length) {
                    // Auto-stop timer and capture final session duration
                    if (timerRunning && sessionStartTs) {
                        const { snapNow } = pendingDurationRef.current ?? { snapNow: Date.now() };
                        setSessionDurationFinal(Math.floor((snapNow - sessionStartTs) / 1000));
                    }
                    handleStopTimer();
                    setSessionComplete(true);
                } else {
                    // Advance to next exercise — reset exercise lap timestamp
                    if (timerRunning) {
                        const lapTs = pendingDurationRef.current?.snapNow ?? Date.now();
                        setExerciseStartTs(lapTs);
                        setNow(lapTs);
                    }
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
        if (hasValidationErrors) { alert(t('workout.invalidWeight')); return; }
        // Prepare sets: normalize and convert to kg for storage
        const preparedSets = sets.map(s => ({
            ...s,
            weight: inputWeightToKg(s.weight),
            reps: parseInt(String(s.reps), 10),
        }));
        if (inPlanMode && planExEntry) {
            const activeExerciseId = overrideExercise ? overrideExercise.id : planExEntry.exercise.id;
            // Capture durations at click time so server round-trip doesn't inflate them
            const snapNow = Date.now();
            const snapExDur = (timerRunning && exerciseStartTs) ? Math.floor((snapNow - exerciseStartTs) / 1000) : null;
            const snapSesDur = (timerRunning && sessionStartTs) ? Math.floor((snapNow - sessionStartTs) / 1000) : null;
            pendingDurationRef.current = { exerciseDur: snapExDur, sessionDur: snapSesDur, snapNow };
            saveWorkoutMutation.mutate({
                date,
                exercise: activeExerciseId,
                notes,
                sets: preparedSets,
                plan_day: planDayId,
                plan_exercise: overrideExercise ? null : planExEntry.id,
                exercise_duration_seconds: snapExDur,
                session_duration_seconds: snapSesDur,
            });
        } else {
            if (!exercise) { alert(t('workout.needExercise')); return; }
            saveWorkoutMutation.mutate({ date, exercise, notes, sets: preparedSets });
        }
    };

    const handleReset = () => {
        setSessionComplete(false);
        setSessionLog([]);
        setCurrentExIndex(0);
        setNotes('');
        setSets([emptySet(1)]);
        setDate(today());
        setOverrideExercise(null);
        setIsSwapOpen(false);
        setSwapSearchQuery('');
        setSetFieldErrors({});
        setSessionDurationFinal(null);
        handleStopTimer();
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
    };

    // â”€â”€ Session complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (sessionComplete) {
        return (
            <WorkoutSummary
                date={date}
                dayLabel={planDay?.label}
                sessionLog={sessionLog}
                sessionDuration={sessionDurationFinal}
                onReset={handleReset}
            />
        );
    }

    const planHintText = (planExEntry && inPlanMode)
        ? t('plan.target', { sets: planExEntry.target_sets, min: planExEntry.reps_min, max: planExEntry.reps_max })
        : null;

    const currentExerciseId = inPlanMode
        ? (overrideExercise ? String(overrideExercise.id) : (planExEntry ? String(planExEntry.exercise.id) : ''))
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
                                                    className={'px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ' + (planDayId === day.id ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Stopwatch */}
                                {planDay && (
                                    <div className="flex items-center gap-4 px-4 py-3 bg-gray-950 rounded-2xl border border-gray-800">
                                        {timerRunning ? (
                                            <>
                                                <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    REC
                                                </span>
                                                <div className="flex flex-col items-center flex-1">
                                                    <span className="text-2xl font-mono font-bold text-white tracking-widest">
                                                        {formatMmSs(exerciseSecs)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">exercise</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-sm font-mono text-gray-400">{formatMmSs(sessionSecs)}</span>
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">session</span>
                                                </div>
                                                <button type="button" onClick={handleStopTimer}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                    title="Stop timer">
                                                    <Square className="w-4 h-4 fill-current" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <Timer className="w-4 h-4 text-gray-600" />
                                                <span className="flex-1 text-sm text-gray-500">Start stopwatch when ready</span>
                                                <button type="button" onClick={handleStartTimer}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 hover:bg-green-600/30 font-medium text-sm transition-colors"
                                                    title="Start timer">
                                                    <Play className="w-4 h-4 fill-current" /> Start
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

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
                                                style={{ width: ((currentExIndex / planDay.exercises.length) * 100) + '%' }}
                                            />
                                        </div>
                                        {planExEntry && (
                                            <div className="bg-green-600/10 border border-green-500/20 rounded-2xl px-5 py-4">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-xs text-green-400/70 font-medium uppercase tracking-wider">
                                                        {t('workout.currentExercise')}
                                                    </p>
                                                    <button type="button"
                                                        onClick={() => { setIsSwapOpen(o => !o); setSwapSearchQuery(''); }}
                                                        className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800"
                                                        title="Switch exercise"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {isSwapOpen ? (
                                                    <div className="mt-2 space-y-1">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                            <input type="text" autoFocus
                                                                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                                                placeholder={t('workout.searchExercises')}
                                                                value={swapSearchQuery}
                                                                onChange={e => setSwapSearchQuery(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-xl">
                                                            {exercises
                                                                .filter(ex => { const q = swapSearchQuery.toLowerCase(); return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q)); })
                                                                .sort((a, b) => exName(a, i18n.language).localeCompare(exName(b, i18n.language)))
                                                                .map(ex => (
                                                                    <div key={ex.id}
                                                                        className={'px-4 py-2.5 cursor-pointer hover:bg-gray-800 text-sm transition-colors ' + (overrideExercise?.id === ex.id ? 'text-green-400 bg-green-600/20' : 'text-gray-300')}
                                                                        onClick={() => { setOverrideExercise(ex); setIsSwapOpen(false); }}
                                                                    >
                                                                        {exName(ex, i18n.language)}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-lg font-bold text-white">
                                                            {overrideExercise ? exName(overrideExercise, i18n.language) : exName(planExEntry.exercise, i18n.language)}
                                                            {overrideExercise && (
                                                                <span className="ml-2 text-xs text-green-400/70 font-normal">(changed)</span>
                                                            )}
                                                        </p>
                                                        <p className="text-sm text-gray-400 mt-0.5">{planHintText}</p>
                                                    </>
                                                )}
                                            </div>
                                        )}
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
                                                <ChevronDown className={'w-4 h-4 text-gray-500 transition-transform ' + (isDropdownOpen ? 'rotate-180' : '')} />
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
                                                                    className={'px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm ' + (exercise === ex.id.toString() ? 'bg-green-600/20 text-green-400' : 'text-gray-300')}
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
                            </div>
                        )}

                        {/* Last workout reference */}
                        <LastWorkoutPanel exerciseId={currentExerciseId} t={t} weightUnit={weightUnit} />

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
                                            onSetBlur={handleSetBlur}
                                            onRemove={handleRemoveSet}
                                            canRemove={sets.length > 1}
                                            t={t}
                                            planHint={index === 0 && planHintText ? planHintText : null}
                                            weightUnit={weightUnit}
                                            fieldErrors={setFieldErrors[index]}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes (always at bottom, before buttons) */}
                        {(inPlanMode ? !!planDay : !!exercise || !hasPlan) && (
                            <div className="pt-6 border-t border-gray-800 space-y-2">
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

                        {/* Add Set + Submit row */}
                        <div className="pt-6 border-t border-gray-800 flex gap-3">
                            <button type="button" onClick={handleAddSet}
                                disabled={!inPlanMode && !exercise}
                                className="flex-1 py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-5 h-5" /> {t('workout.addAnotherSet')}
                            </button>
                            <button
                                type="submit"
                                disabled={saveWorkoutMutation.isPending || (!inPlanMode && !exercise) || (inPlanMode && !planExEntry) || hasValidationErrors}
                                className="flex-1 py-4 px-4 rounded-2xl shadow-lg shadow-green-600/20 text-base font-bold text-white bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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



