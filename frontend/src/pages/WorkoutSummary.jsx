import React, { useState } from 'react';
import { CheckCircle2, LineChart, RotateCcw, Calendar, Pencil, Check, X, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchProfile, updateSet } from '../lib/queries';

const formatMmSs = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Session summary screen shown when the user finishes all exercises in a plan day.
 *
 * Props:
 *   date        — string, e.g. "2026-02-22"
 *   dayLabel    — string, e.g. "A"
 *   sessionLog  — array of { exerciseName, sets: [{id?, weight, reps, reached_failure, intensity_method}] }
 *   onReset     — callback to reset the Workout page back to day selector
 */
function WorkoutSummary({ date, dayLabel, sessionLog, sessionDuration, onReset }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Unit preference
    const { data: profile = { weight_unit: 'kg' } } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
        staleTime: 5 * 60 * 1000,
    });
    const weightUnit = profile.weight_unit;
    const displayW = (kg) => weightUnit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(2)) : kg;
    const inputToKg = (val) => {
        const num = parseFloat(String(val).replace(',', '.'));
        return weightUnit === 'lbs' ? parseFloat((num / 2.20462).toFixed(4)) : num;
    };

    // Local inline-edit state per set (keyed by set id)
    const [editingId, setEditingId] = useState(null);
    const [editWeight, setEditWeight] = useState('');
    const [editReps, setEditReps] = useState('');

    // Mirror sessionLog in local state so edits are reflected immediately
    const [localLog, setLocalLog] = useState(() => sessionLog.map(e => ({
        ...e,
        sets: e.sets.map(s => ({ ...s })),
    })));

    const updateSetMutation = useMutation({
        mutationFn: ({ setId, weight, reps }) => updateSet({ setId, weight, reps }),
        onSuccess: (updatedSet, { exIdx, setIdx }) => {
            setLocalLog(prev => {
                const next = prev.map((e, ei) => ei === exIdx
                    ? { ...e, sets: e.sets.map((s, si) => si === setIdx ? { ...s, weight: updatedSet.weight, reps: updatedSet.reps } : s) }
                    : e);
                return next;
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.history() });
        },
    });

    const startEdit = (set) => {
        setEditingId(set.id);
        setEditWeight(String(displayW(set.weight)));
        setEditReps(String(set.reps));
    };

    const saveEdit = (set, exIdx, setIdx) => {
        const kgWeight = inputToKg(editWeight);
        const repsVal = parseInt(editReps, 10);
        if (isNaN(kgWeight) || kgWeight < 0 || isNaN(repsVal) || repsVal <= 0) return;
        updateSetMutation.mutate({ setId: set.id, weight: kgWeight, reps: repsVal, exIdx, setIdx });
        setEditingId(null);
    };

    return (
        <div className="max-w-2xl mx-auto font-sans">
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-10 sm:p-12 text-center">
                    {/* Icon */}
                    <div className="h-16 w-16 bg-green-600/10 rounded-2xl flex items-center justify-center border border-green-500/20 mx-auto mb-6">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">{t('workout.sessionComplete')}</h2>
                    <p className="text-gray-400 mb-1">{t('workout.sessionSummaryTitle')}</p>
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5 mb-2">
                        <Calendar className="w-4 h-4" />
                        {date}
                        {dayLabel && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 text-xs font-semibold">
                                {dayLabel}
                            </span>
                        )}
                    </p>
                    {sessionDuration != null ? (
                        <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400 mb-8 mt-1">
                            <Timer className="w-4 h-4" />
                            <span className="font-mono font-semibold">{formatMmSs(sessionDuration)}</span>
                            <span className="text-xs text-gray-500">total</span>
                        </div>
                    ) : <div className="mb-6" />}

                    {/* Exercise list */}
                    <div className="space-y-3 text-left mb-8">
                        {localLog.map((entry, exIdx) => (
                            <div key={exIdx} className="bg-gray-950 rounded-2xl border border-gray-800 p-4">
                                <p className="text-sm font-semibold text-white mb-2">{entry.exerciseName}</p>

                                {/* Inline summary: {time} – w×r[F][method] | w×r | … */}
                                <div className="flex flex-wrap items-center gap-y-1.5 text-xs">
                                    {entry.duration != null && (
                                        <>
                                            <span className="font-mono font-semibold text-green-400 mr-1.5">{formatMmSs(entry.duration)}</span>
                                            <span className="text-gray-600 mr-1.5">–</span>
                                        </>
                                    )}
                                    {entry.sets.map((s, setIdx) => (
                                        <React.Fragment key={setIdx}>
                                            {setIdx > 0 && <span className="text-gray-600 mx-1.5">|</span>}
                                            {editingId === s.id && s.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text" inputMode="decimal"
                                                        className="w-14 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                                        value={editWeight}
                                                        onChange={e => setEditWeight(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <span className="text-gray-500">×</span>
                                                    <input
                                                        type="text" inputMode="numeric"
                                                        className="w-10 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                                        value={editReps}
                                                        onChange={e => setEditReps(e.target.value)}
                                                    />
                                                    <button type="button" onClick={() => saveEdit(s, exIdx, setIdx)}
                                                        className="p-0.5 text-green-400 hover:text-green-300">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button type="button" onClick={() => setEditingId(null)}
                                                        className="p-0.5 text-gray-500 hover:text-gray-300">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-0.5 group/setbtn"
                                                    onClick={() => s.id && startEdit(s)}
                                                    title={s.id ? t('history.editSet') : undefined}
                                                >
                                                    <span className="text-white font-medium group-hover/setbtn:text-green-400 transition-colors">
                                                        {displayW(s.weight)}<span className="text-gray-500">{weightUnit}</span>
                                                    </span>
                                                    <span className="text-gray-500 mx-0.5">×</span>
                                                    <span className="text-white font-medium group-hover/setbtn:text-green-400 transition-colors">{s.reps}</span>
                                                    {s.reached_failure && (
                                                        <span className="ml-0.5 text-[10px] px-0.5 rounded bg-red-500/20 text-red-400 font-bold leading-none">F</span>
                                                    )}
                                                    {s.intensity_method && s.intensity_method !== 'none' && (
                                                        <span className="ml-0.5 text-[10px] px-0.5 rounded bg-green-500/20 text-green-400 font-medium leading-none">{s.intensity_method}</span>
                                                    )}
                                                    {s.id && <Pencil className="ml-0.5 w-2.5 h-2.5 text-gray-600 opacity-0 group-hover/setbtn:opacity-100 transition-opacity" />}
                                                </button>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/graph')}
                            className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <LineChart className="w-4 h-4" /> {t('workout.viewProgress')}
                        </button>
                        <button
                            type="button"
                            onClick={onReset}
                            className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" /> {t('workout.logAnotherDay')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WorkoutSummary;
