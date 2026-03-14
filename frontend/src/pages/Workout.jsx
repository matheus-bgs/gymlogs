import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Calendar, Activity, FileText, X, Search, ChevronDown, ChevronUp, CheckCircle2, Play, Square, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    queryKeys, fetchExercises, fetchLastWorkout, fetchActivePlan, fetchSessionProgress,
    fetchProfile, saveWorkout, createExercise, deleteWorkoutExercise,
} from '../lib/queries';
import { exName } from '../lib/i18nUtils';
import WorkoutSummary from './WorkoutSummary';
import WeightCard from './WeightCard';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = () => localDate();

const emptySet = (order = 1) => ({ order, weight: '', reps: '', reached_failure: false, intensity_method: 'none' });

const buildSets = (count) => Array.from({ length: count }, (_, i) => emptySet(i + 1));

// â”€â”€ Toast component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const formatMmSs = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
};

function Toast({ message, type = 'success' }) {
    if (!message) return null;
    const isError = type === 'error';
    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
            <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl font-medium text-sm text-white ${
                isError ? 'bg-red-700' : 'bg-green-700'
            }`}>
                {isError
                    ? <X className="w-4 h-4" />
                    : <CheckCircle2 className="w-4 h-4" />
                }
                {message}
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

// ── ExerciseCard ──────────────────────────────────────────────────────────────
// One collapsible card per exercise. Unlogged = gray; logged = green.

function ExerciseCard({
    card, isExpanded, weightUnit, t, lang, date, planDayId,
    onToggle, onLog, onRemoveCard, isSaving,
}) {
    const unit = weightUnit || 'kg';
    const inputWeightToKg = (val) => {
        const num = parseFloat(String(val).replace(',', '.'));
        return unit === 'lbs' ? parseFloat((num / 2.20462).toFixed(4)) : num;
    };
    const displayW = (kg) => unit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(2)) : kg;

    const [sets, setSets] = useState(() =>
        card.isLogged && card.loggedSets?.length
            ? card.loggedSets.map(s => ({
                ...s,
                weight: String(displayW(s.weight)),
                reps: String(s.reps),
            }))
            : (card.sets?.length ? card.sets : [emptySet(1)])
    );
    const [notes, setNotes] = useState(card.loggedNotes ?? '');
    const [fieldErrors, setFieldErrors] = useState({});

    // Sync sets + notes when card flips to logged (resume) or is reset from outside
    useEffect(() => {
        if (card.isLogged && card.loggedSets?.length) {
            setSets(card.loggedSets.map(s => ({
                ...s,
                weight: String(displayW(s.weight)),
                reps: String(s.reps),
            })));
        }
        if (card.loggedNotes !== undefined) setNotes(card.loggedNotes ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [card.isLogged, card.loggedSets, card.loggedNotes]);

    const handleSetChange = (idx, field, value) =>
        setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });

    const handleSetBlur = (idx, field) => {
        const rawVal = sets[idx]?.[field];
        if (field === 'weight') {
            const normalized = String(rawVal ?? '').replace(',', '.');
            const num = parseFloat(normalized);
            const invalid = isNaN(num) || num < 0;
            setFieldErrors(prev => ({ ...prev, [idx]: { ...prev[idx], weight: invalid } }));
            if (!invalid) setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], weight: normalized }; return n; });
        } else if (field === 'reps') {
            const num = parseInt(String(rawVal ?? ''), 10);
            const invalid = isNaN(num) || num <= 0;
            setFieldErrors(prev => ({ ...prev, [idx]: { ...prev[idx], reps: invalid } }));
            if (!invalid) setSets(prev => { const n = [...prev]; n[idx] = { ...n[idx], reps: String(num) }; return n; });
        }
    };

    const hasErrors = Object.values(fieldErrors).some(e => e && (e.weight || e.reps));

    const planHintText = card.planExercise
        ? t('plan.target', {
            sets: card.planExercise.target_sets,
            min: card.planExercise.reps_min,
            max: card.planExercise.reps_max,
        })
        : null;

    const handleSubmit = () => {
        if (sets.length === 0) return;
        const missing = sets.find(s => String(s.weight ?? '').trim() === '' || String(s.reps ?? '').trim() === '');
        if (missing) return;
        if (hasErrors) return;
        const preparedSets = sets.map(s => ({
            ...s,
            weight: inputWeightToKg(s.weight),
            reps: parseInt(String(s.reps), 10),
        }));
        onLog(card.id, preparedSets, notes);
    };

    const isDone = card.isLogged;
    const exDisplayName = exName(card.exercise, lang);
    const muscleGroup = card.exercise?.muscle_group ?? '';

    // Card border/bg classes
    const cardCls = isDone
        ? 'bg-green-950/30 border border-green-700/50 rounded-2xl transition-all'
        : 'bg-gray-900 border border-gray-800 rounded-2xl transition-all';

    return (
        <div className={cardCls}>
            {/* ── Collapsed header (always visible) ── */}
            <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                onClick={onToggle}
            >
                {/* Done indicator */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone
                        ? 'bg-green-600 border-green-500'
                        : 'bg-gray-800 border-gray-700'
                }`}>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isDone ? 'text-green-300' : 'text-white'}`}>
                        {exDisplayName}
                    </p>
                    {isDone && card.loggedSets?.length ? (
                        <p className="text-xs text-green-400/80 mt-0.5 flex flex-wrap items-center gap-x-0.5 gap-y-0.5">
                            {card.loggedDuration != null && (
                                <><span className="font-mono font-semibold">{formatMmSs(card.loggedDuration)}</span><span className="text-gray-600 mx-1">–</span></>
                            )}
                            {card.loggedSets.map((s, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span className="text-gray-600 mx-1">|</span>}
                                    <span>{displayW(s.weight)}{unit}</span>
                                    <span className="text-green-400/50 mx-0.5">×</span>
                                    <span>{s.reps}</span>
                                    {s.reached_failure && <span className="text-[10px] px-0.5 rounded bg-red-500/20 text-red-400 font-bold leading-none">F</span>}
                                    {s.intensity_method && s.intensity_method !== 'none' && <span className="text-[10px] px-0.5 rounded bg-green-500/20 text-green-400 font-medium leading-none">{s.intensity_method}</span>}
                                </React.Fragment>
                            ))}
                        </p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-0.5">
                            {planHintText ?? muscleGroup}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Remove button */}
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onRemoveCard(card.id); }}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title={t('workout.removeCard')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-500" />
                        : <ChevronDown className="w-5 h-5 text-gray-500" />
                    }
                </div>
            </div>

            {/* ── Expanded body ── */}
            {isExpanded && (
                <div className="px-5 pb-5 space-y-5 border-t border-gray-800/60">
                    {/* Last workout reference */}
                    <LastWorkoutPanel exerciseId={String(card.exercise.id)} t={t} weightUnit={unit} />

                    {/* Sets */}
                    <div className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-white">{t('workout.workingSets')}</h4>
                            <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
                                {t('workout.setsTotal', { count: sets.length })}
                            </span>
                        </div>
                        <div className="space-y-4">
                            {sets.map((set, index) => (
                                <SetCard
                                    key={index}
                                    set={set}
                                    index={index}
                                    disabled={false}
                                    onSetChange={handleSetChange}
                                    onSetBlur={handleSetBlur}
                                    onRemove={(idx) => setSets(prev =>
                                        prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }))
                                    )}
                                    canRemove={sets.length > 1}
                                    t={t}
                                    planHint={index === 0 && planHintText ? planHintText : null}
                                    weightUnit={unit}
                                    fieldErrors={fieldErrors[index]}
                                />
                            ))}
                        </div>
                        {/* Add set */}
                        <button
                            type="button"
                            onClick={() => setSets(prev => [...prev, emptySet(prev.length + 1)])}
                            className="mt-4 w-full py-3 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" /> {t('workout.addAnotherSet')}
                        </button>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                            <FileText className="w-3.5 h-3.5" /> {t('workout.notes')}
                        </label>
                        <textarea
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-green-500 outline-none resize-none transition-all"
                            rows="2"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={t('workout.notesPlaceholder')}
                        />
                    </div>

                    {/* Log button */}
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving || hasErrors || sets.length === 0}
                        className={`w-full py-4 rounded-2xl font-bold text-base text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDone
                                ? 'bg-green-700 hover:bg-green-600 shadow-lg shadow-green-700/20'
                                : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/20'
                        }`}
                    >
                        {isSaving ? t('workout.saving') : isDone ? t('workout.relogExercise') : t('workout.logExercise')}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

function Workout() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const pageTopRef = useRef(null);

    // State
    const [date, setDate] = useState(today());
    const [planDayId, setPlanDayId] = useState(null);
    const [freeformMode, setFreeformMode] = useState(false);

    const [cardList, setCardList] = useState([]);
    const [expandedCardId, setExpandedCardId] = useState(null);

    const [showSummary, setShowSummary] = useState(false);
    const [sessionLog, setSessionLog] = useState([]);
    const [sessionNotes, setSessionNotes] = useState('');
    const [sessionDurationFinal, setSessionDurationFinal] = useState(null);

    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    const [timerRunning, setTimerRunning] = useState(false);
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [perExSeconds, setPerExSeconds] = useState(0);
    const timerRef = useRef(null);

    const [addExSearch, setAddExSearch] = useState('');
    const [addExOpen, setAddExOpen] = useState(false);
    const addExRef = useRef(null);

    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');

    const savingCardRef = useRef(null);

    // Queries
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

    const { data: activePlan } = useQuery({
        queryKey: queryKeys.activePlan(),
        queryFn: fetchActivePlan,
        staleTime: 5 * 60 * 1000,
    });

    const hasPlan = !!activePlan && activePlan.days.length > 0;
    const inPlanMode = hasPlan && !freeformMode;
    const planDay = inPlanMode ? (activePlan?.days.find(d => d.id === planDayId) ?? null) : null;

    const { data: sessionProgress = [] } = useQuery({
        queryKey: queryKeys.sessionProgress(date, planDayId),
        queryFn: () => fetchSessionProgress(date, planDayId),
        enabled: inPlanMode && !!planDayId,
        staleTime: 0,
    });

    // Auto-select next plan day
    useEffect(() => {
        if (hasPlan && !planDayId) {
            const days = activePlan.days;
            const lastDayId = activePlan.last_day_id;
            if (lastDayId) {
                const lastIdx = days.findIndex(d => d.id === lastDayId);
                const nextIdx = lastIdx !== -1 ? (lastIdx + 1) % days.length : 0;
                setPlanDayId(days[nextIdx].id);
            } else {
                setPlanDayId(days[0].id);
            }
        }
    }, [hasPlan, activePlan, planDayId]);

    // Build card list when plan day or date changes
    useEffect(() => {
        if (!inPlanMode || !planDay) {
            if (freeformMode) setCardList([]);
            return;
        }
        const cards = planDay.exercises.map(pe => ({
            id: `plan-${pe.id}`,
            exercise: pe.exercise,
            planExercise: { id: pe.id, target_sets: pe.target_sets, reps_min: pe.reps_min, reps_max: pe.reps_max },
            sets: buildSets(pe.target_sets),
            isLogged: false,
            loggedSets: null,
            workoutExerciseId: null,
        }));
        setCardList(cards);
        setExpandedCardId(null);
        setSessionLog([]);
        setShowSummary(false);
        setSessionNotes('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planDayId, date]);

    // Apply session progress (resume)
    useEffect(() => {
        if (!sessionProgress?.length || !cardList.length) return;
        let resumed = false;
        setCardList(prev => prev.map(card => {
            const match = sessionProgress.find(p => p.exercise_id === card.exercise.id);
            if (!match) return card;
            resumed = true;
            return { ...card, isLogged: true, loggedSets: match.sets, loggedNotes: match.notes ?? '', loggedDuration: null, workoutExerciseId: match.workout_exercise_id };
        }));
        if (resumed) showToast(t('workout.resumingSession'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionProgress]);

    // Re-build session log from resume data
    useEffect(() => {
        if (!sessionProgress?.length) return;
        const rebuiltLog = sessionProgress.map(p => {
            const card = cardList.find(c => c.exercise.id === p.exercise_id);
            if (!card) return null;
            return { exerciseName: exName(card.exercise, i18n.language), sets: p.sets, duration: null };
        }).filter(Boolean);
        if (rebuiltLog.length > 0) setSessionLog(rebuiltLog);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionProgress]);

    // Close add-exercise dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (addExRef.current && !addExRef.current.contains(e.target)) {
                setAddExOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Timer
    useEffect(() => {
        if (!timerRunning) {
            clearInterval(timerRef.current);
            return;
        }
        timerRef.current = setInterval(() => {
            setSessionSeconds(s => s + 1);
            setPerExSeconds(p => p + 1);
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timerRunning]);

    // Toast
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 3500);
    }, []);

    // Mutations
    const createExerciseMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: (newEx) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.exercises() });
            addCardForExercise(newEx);
            setIsCreatingExercise(false);
            setNewExerciseName('');
            setAddExOpen(false);
        },
        onError: () => showToast(t('workout.createExerciseFailed'), 'error'),
    });

    const saveWorkoutMutation = useMutation({
        mutationFn: saveWorkout,
        onSuccess: (response, variables) => {
            const { cardId, exerciseObj, preparedSets, notes, planDayIdAtSubmit } = variables._meta;
            const exerciseName = exName(exerciseObj, i18n.language);
            const loggedSets = response?.sets?.length ? response.sets : preparedSets;
            const perExDur = perExSeconds;

            setCardList(prev => prev.map(c =>
                c.id === cardId ? { ...c, isLogged: true, loggedSets, loggedNotes: notes ?? '', loggedDuration: perExDur, workoutExerciseId: response?.workout_exercise_id ?? c.workoutExerciseId } : c
            ));

            setSessionLog(prev => {
                const idx = prev.findIndex(e => e.exerciseName === exerciseName);
                const entry = { exerciseName, sets: loggedSets, duration: perExDur };
                if (idx !== -1) { const next = [...prev]; next[idx] = entry; return next; }
                return [...prev, entry];
            });

            setPerExSeconds(0);
            savingCardRef.current = null;

            queryClient.invalidateQueries({ queryKey: queryKeys.lastWorkout(exerciseObj.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.topsets(exerciseObj.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayIdAtSubmit) });
            queryClient.invalidateQueries({ queryKey: queryKeys.exercisesWithData() });

            showToast(t('workout.exerciseLogged', { name: exerciseName }));

            setCardList(prev => {
                const doneIdx = prev.findIndex(c => c.id === cardId);
                const nextUnlogged = prev.find((c, i) => i > doneIdx && !c.isLogged && c.id !== cardId);
                setExpandedCardId(nextUnlogged ? nextUnlogged.id : null);
                return prev;
            });
        },
        onError: () => {
            savingCardRef.current = null;
            showToast(t('workout.saveWorkoutFailed'), 'error');
        },
    });

    const deleteWorkoutExerciseMutation = useMutation({
        mutationFn: ({ weId }) => deleteWorkoutExercise(weId),
        onSuccess: (_data, { cardId, exerciseName }) => {
            setCardList(prev => prev.filter(c => c.id !== cardId));
            setSessionLog(prev => prev.filter(e => e.exerciseName !== exerciseName));
            queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
        },
        onError: () => showToast(t('workout.saveWorkoutFailed'), 'error'),
    });

    // Helpers
    const addCardForExercise = (exercise) => {
        if (cardList.some(c => c.exercise.id === exercise.id)) {
            showToast(t('workout.exerciseAlreadyAdded'), 'error');
            return;
        }
        const newCard = {
            id: `free-${exercise.id}-${Date.now()}`,
            exercise,
            planExercise: null,
            sets: buildSets(3),
            isLogged: false,
            loggedSets: null,
            workoutExerciseId: null,
        };
        setCardList(prev => [...prev, newCard]);
        setExpandedCardId(newCard.id);
        setAddExSearch('');
        setAddExOpen(false);
    };

    const handleStartSession = () => {
        setTimerRunning(true);
        const first = cardList.find(c => !c.isLogged);
        if (first) setExpandedCardId(first.id);
    };

    const handleToggleCard = (cardId) => {
        setExpandedCardId(prev => prev === cardId ? null : cardId);
    };

    const handleLogExercise = async (cardId, preparedSets, notes = '') => {
        const card = cardList.find(c => c.id === cardId);
        if (!card) return;
        savingCardRef.current = cardId;

        const doSave = () => {
            saveWorkoutMutation.mutate({
                date,
                exercise: card.exercise.id,
                notes,
                sets: preparedSets,
                plan_day: planDayId ?? undefined,
                plan_exercise: card.planExercise?.id ?? undefined,
                exercise_duration_seconds: perExSeconds || null,
                session_duration_seconds: sessionSeconds || null,
                _meta: { cardId, exerciseObj: card.exercise, preparedSets, notes, planDayIdAtSubmit: planDayId },
            });
        };

        if (card.isLogged && card.workoutExerciseId) {
            try {
                await deleteWorkoutExercise(card.workoutExerciseId);
                setCardList(prev => prev.map(c =>
                    c.id === cardId ? { ...c, isLogged: false, loggedSets: null, workoutExerciseId: null } : c
                ));
                doSave();
            } catch {
                showToast(t('workout.saveWorkoutFailed'), 'error');
                savingCardRef.current = null;
            }
        } else {
            doSave();
        }
    };

    const handleRemoveCard = (cardId) => {
        const card = cardList.find(c => c.id === cardId);
        if (!card) return;
        if (card.isLogged && card.workoutExerciseId) {
            if (!window.confirm(t('workout.confirmRemoveLogged'))) return;
            const exerciseName = exName(card.exercise, i18n.language);
            deleteWorkoutExerciseMutation.mutate({ weId: card.workoutExerciseId, cardId, exerciseName });
        } else {
            setCardList(prev => prev.filter(c => c.id !== cardId));
        }
        if (expandedCardId === cardId) setExpandedCardId(null);
    };

    const handleFinishWorkout = () => {
        setTimerRunning(false);
        setSessionDurationFinal(sessionSeconds);
        setShowSummary(true);
    };

    const handleReset = () => {
        setShowSummary(false);
        setSessionLog([]);
        setCardList([]);
        setExpandedCardId(null);
        setDate(today());
        setSessionNotes('');
        setTimerRunning(false);
        setSessionSeconds(0);
        setPerExSeconds(0);
        setSessionDurationFinal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionProgress(date, planDayId) });
    };

    const loggedCount = cardList.filter(c => c.isLogged).length;
    const canFinish = sessionLog.length > 0;

    if (showSummary) {
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

    return (
        <div className="max-w-4xl mx-auto font-sans" ref={pageTopRef}>
            <Toast message={toast?.message} type={toast?.type} />
            <WeightCard weightUnit={weightUnit} />

            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl">
                <div className="px-6 py-8 sm:p-10 space-y-6">

                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20">
                            <Activity className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{t('workout.title')}</h2>
                            <p className="text-sm text-gray-400">{t('workout.subtitle')}</p>
                        </div>
                        {hasPlan && (
                            <button type="button"
                                onClick={() => { setFreeformMode(f => !f); setCardList([]); setExpandedCardId(null); setSessionLog([]); }}
                                className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                            >
                                {freeformMode ? (activePlan?.name ?? 'Use plan') : t('workout.logWithoutPlan')}
                            </button>
                        )}
                    </div>

                    {/* Date + Day selector */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Calendar className="w-4 h-4 text-gray-500" /> {t('workout.date')}
                            </label>
                            <input type="date" required
                                className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                value={date}
                                onChange={e => { setDate(e.target.value); setCardList([]); setSessionLog([]); setShowSummary(false); setTimerRunning(false); setSessionSeconds(0); setPerExSeconds(0); }}
                            />
                        </div>
                        {inPlanMode && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                    <Activity className="w-4 h-4 text-gray-500" /> {t('workout.selectDay')}
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {activePlan.days.map(day => (
                                        <button key={day.id} type="button"
                                            onClick={() => { if (planDayId !== day.id) { setPlanDayId(day.id); setCardList([]); setSessionLog([]); setShowSummary(false); setTimerRunning(false); setSessionSeconds(0); setPerExSeconds(0); } }}
                                            className={'px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ' + (planDayId === day.id ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white')}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stopwatch */}
                    <div className="flex items-center gap-4 px-4 py-3 bg-gray-950 rounded-2xl border border-gray-800">
                        {timerRunning ? (
                            <>
                                <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    REC
                                </span>
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-2xl font-mono font-bold text-white tracking-widest">{formatMmSs(perExSeconds)}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">exercise</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-mono text-gray-400">{formatMmSs(sessionSeconds)}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">session</span>
                                </div>
                                <button type="button" onClick={() => setTimerRunning(false)}
                                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Pause timer">
                                    <Square className="w-4 h-4 fill-current" />
                                </button>
                            </>
                        ) : (
                            <>
                                <Timer className="w-4 h-4 text-gray-600" />
                                <span className="flex-1 text-sm text-gray-500">
                                    {sessionSeconds > 0 ? formatMmSs(sessionSeconds) : t('workout.startWorkout')}
                                </span>
                                {cardList.length > 0 && (
                                    <button type="button" onClick={handleStartSession}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 text-green-400 hover:bg-green-600/30 font-medium text-sm transition-colors">
                                        <Play className="w-4 h-4 fill-current" />
                                        {sessionSeconds > 0 ? 'Resume' : t('workout.startWorkout')}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Progress bar */}
                    {inPlanMode && planDay && cardList.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{loggedCount}/{cardList.length} done</span>
                                <span>{cardList.length - loggedCount} remaining</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: ((loggedCount / cardList.length) * 100) + '%' }} />
                            </div>
                        </div>
                    )}

                    {/* Exercise card list */}
                    {cardList.length > 0 ? (
                        <div className="space-y-3">
                            {cardList.map(card => (
                                <ExerciseCard
                                    key={card.id}
                                    card={card}
                                    isExpanded={expandedCardId === card.id}
                                    weightUnit={weightUnit}
                                    t={t}
                                    lang={i18n.language}
                                    date={date}
                                    planDayId={planDayId}
                                    onToggle={() => handleToggleCard(card.id)}
                                    onLog={handleLogExercise}
                                    onRemoveCard={handleRemoveCard}
                                    isSaving={savingCardRef.current === card.id && saveWorkoutMutation.isPending}
                                />
                            ))}
                        </div>
                    ) : (
                        !inPlanMode && (
                            <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-700 rounded-2xl">
                                {t('workout.addExercise')} {String.fromCharCode(8593)}
                            </div>
                        )
                    )}

                    {/* Add exercise */}
                    <div className="pt-2">
                        {isCreatingExercise ? (
                            <div className="flex gap-2">
                                <input type="text" autoFocus
                                    className="flex-1 px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                    placeholder={t('workout.exerciseNamePlaceholder')}
                                    value={newExerciseName}
                                    onChange={e => setNewExerciseName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && newExerciseName.trim() && createExerciseMutation.mutate(newExerciseName.trim())}
                                />
                                <button type="button" onClick={() => newExerciseName.trim() && createExerciseMutation.mutate(newExerciseName.trim())}
                                    className="px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors">
                                    {t('workout.add')}
                                </button>
                                <button type="button" onClick={() => { setIsCreatingExercise(false); setNewExerciseName(''); }}
                                    className="px-3 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative" ref={addExRef}>
                                <button type="button" onClick={() => setAddExOpen(o => !o)}
                                    className="w-full py-3 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                                    <Plus className="w-4 h-4" /> {t('workout.addExercise')}
                                </button>
                                {addExOpen && (
                                    <div className="absolute z-10 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                        <div className="p-2 border-b border-gray-800">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                <input type="text" autoFocus
                                                    className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                                    placeholder={t('workout.searchExercises')}
                                                    value={addExSearch}
                                                    onChange={e => setAddExSearch(e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {exercises
                                                .filter(ex => { const q = addExSearch.toLowerCase(); return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q)); })
                                                .sort((a, b) => exName(a, i18n.language).localeCompare(exName(b, i18n.language)))
                                                .map(ex => (
                                                    <div key={ex.id}
                                                        className="px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm text-gray-300 hover:text-white"
                                                        onClick={() => addCardForExercise(ex)}>
                                                        {exName(ex, i18n.language)}
                                                    </div>
                                                ))}
                                            {exercises.filter(ex => { const q = addExSearch.toLowerCase(); return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q)); }).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">{t('workout.noExercisesFound')}</div>
                                            )}
                                        </div>
                                        <div className="p-2 border-t border-gray-800">
                                            <button type="button"
                                                onClick={() => { setAddExOpen(false); setIsCreatingExercise(true); }}
                                                className="w-full px-3 py-2 text-xs text-green-400 hover:text-green-300 flex items-center gap-1 justify-center transition-colors">
                                                <Plus className="w-3 h-3" /> {t('workout.newExercise')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Session notes + Finish Workout */}
                    {canFinish && (
                        <div className="pt-4 border-t border-gray-800 space-y-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                    <FileText className="w-4 h-4 text-gray-500" /> {t('workout.sessionNotes')}
                                </label>
                                <textarea
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 outline-none resize-none transition-all"
                                    rows="2"
                                    value={sessionNotes}
                                    onChange={e => setSessionNotes(e.target.value)}
                                    placeholder={t('workout.notesPlaceholder')}
                                />
                            </div>
                            <button type="button" onClick={handleFinishWorkout}
                                className="w-full py-4 rounded-2xl font-bold text-base text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" /> {t('workout.finishWorkout')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating mini-timer */}
            {timerRunning && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <div className="flex flex-col items-center leading-none">
                        <span className="text-base font-mono font-bold text-white tracking-widest">{formatMmSs(perExSeconds)}</span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">exercise</span>
                    </div>
                    <span className="text-gray-700 text-xs">|</span>
                    <div className="flex flex-col items-center leading-none">
                        <span className="text-sm font-mono text-gray-400">{formatMmSs(sessionSeconds)}</span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">session</span>
                    </div>
                    <button type="button" onClick={() => setTimerRunning(false)}
                        className="ml-1 p-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Pause timer">
                        <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default Workout;
