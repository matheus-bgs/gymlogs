import React, { useState } from 'react';
import { Clock, Pencil, Check, X, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    queryKeys, fetchHistory, fetchProfile, updateSet,
} from '../lib/queries';
import { exName } from '../lib/i18nUtils';

const formatMmSs = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function History() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();

    const { data: historyData, isLoading } = useQuery({
        queryKey: queryKeys.history(),
        queryFn: fetchHistory,
    });

    const { data: profileData } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
    });

    const weightUnit = profileData?.weight_unit ?? 'kg';
    const sessions = historyData ?? [];

    const displayW = (kg) =>
        weightUnit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(2)) : kg;

    const inputToKg = (val) => {
        const n = parseFloat(String(val).replace(',', '.'));
        return weightUnit === 'lbs' ? parseFloat((n / 2.20462).toFixed(4)) : n;
    };

    // editStates: { [setId]: { weight: string, reps: string } }
    const [editStates, setEditStates] = useState({});
    // localSets: { [setId]: { weight: number, reps: number } } — reflects saved edits
    const [localSets, setLocalSets] = useState({});

    const getSetVal = (set) => localSets[set.id] ?? { weight: set.weight, reps: set.reps };

    const updateSetMutation = useMutation({
        mutationFn: ({ setId, weight, reps }) => updateSet({ setId, weight, reps }),
        onSuccess: (updated, { setId }) => {
            setLocalSets(prev => ({ ...prev, [setId]: { weight: updated.weight, reps: updated.reps } }));
            setEditStates(prev => { const n = { ...prev }; delete n[setId]; return n; });
            queryClient.invalidateQueries({ queryKey: queryKeys.history() });
        },
    });

    const handleEdit = (set) => {
        const cur = getSetVal(set);
        setEditStates(prev => ({
            ...prev,
            [set.id]: {
                weight: displayW(cur.weight).toString(),
                reps: cur.reps.toString(),
            },
        }));
    };

    const handleCancel = (setId) => {
        setEditStates(prev => { const n = { ...prev }; delete n[setId]; return n; });
    };

    const handleSave = (setId) => {
        const es = editStates[setId];
        if (!es) return;
        const weightKg = inputToKg(es.weight);
        const reps = parseInt(es.reps, 10);
        if (isNaN(weightKg) || weightKg < 0 || isNaN(reps) || reps <= 0) return;
        updateSetMutation.mutate({ setId, weight: weightKg, reps });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-gray-900 rounded-3xl border border-gray-800 p-10 text-center">
                    <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">{t('history.title')}</h2>
                    <p className="text-gray-400">{t('history.noHistory')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Page heading */}
            <div>
                <h1 className="text-2xl font-bold text-white">{t('history.title')}</h1>
                <p className="text-gray-400 text-sm mt-1">{t('history.subtitle')}</p>
            </div>

            {sessions.map(session => (
                <div key={session.id} className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    {/* Session header */}
                    <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3 flex-wrap">
                        <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-white font-medium">{session.date}</span>
                        {session.plan_day_label && (
                            <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs font-medium rounded-full border border-green-500/20">
                                {session.plan_day_label}
                            </span>
                        )}
                        {session.duration_seconds != null && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Timer className="w-3 h-3" />
                                <span className="font-mono">{formatMmSs(session.duration_seconds)}</span>
                            </span>
                        )}
                        {session.notes && (
                            <span className="text-xs text-gray-500 truncate flex-1">{session.notes}</span>
                        )}
                    </div>

                    {/* Exercises */}
                    <div className="divide-y divide-gray-800/60">
                        {session.exercises.map(we => (
                            <div key={we.id} className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <p className="text-sm font-semibold text-gray-200">
                                        {exName(we.exercise, i18n.language)}
                                    </p>
                                    {we.duration_seconds != null && (
                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <Timer className="w-3 h-3" />
                                            <span className="font-mono">{formatMmSs(we.duration_seconds)}</span>
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {we.sets.map((set, idx) => {
                                        const isEditing = !!editStates[set.id];
                                        const es = editStates[set.id];
                                        const curVal = getSetVal(set);

                                        return (
                                            <div key={set.id} className="group flex items-center gap-3 text-sm min-h-[32px]">
                                                <span className="text-gray-600 w-5 text-right flex-shrink-0 text-xs">
                                                    {idx + 1}.
                                                </span>

                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="w-20 px-2 py-1 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                                            value={es.weight}
                                                            onChange={e => setEditStates(prev => ({
                                                                ...prev,
                                                                [set.id]: { ...prev[set.id], weight: e.target.value },
                                                            }))}
                                                        />
                                                        <span className="text-gray-500 text-xs">{weightUnit}</span>
                                                        <span className="text-gray-600">×</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            className="w-14 px-2 py-1 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                                            value={es.reps}
                                                            onChange={e => setEditStates(prev => ({
                                                                ...prev,
                                                                [set.id]: { ...prev[set.id], reps: e.target.value },
                                                            }))}
                                                        />
                                                        <span className="text-gray-500 text-xs">reps</span>
                                                        <button
                                                            type="button"
                                                            disabled={updateSetMutation.isPending}
                                                            onClick={() => handleSave(set.id)}
                                                            className="p-1 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors disabled:opacity-50"
                                                            title={t('history.saveSet')}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancel(set.id)}
                                                            className="p-1 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
                                                            title={t('history.cancelEdit')}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-white">
                                                            {displayW(curVal.weight)}{' '}
                                                            <span className="text-gray-400 text-xs">{weightUnit}</span>
                                                            {' × '}
                                                            {curVal.reps}{' '}
                                                            <span className="text-gray-400 text-xs">reps</span>
                                                        </span>
                                                        {set.reached_failure && (
                                                            <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">
                                                                failure
                                                            </span>
                                                        )}
                                                        {set.intensity_method &&
                                                            set.intensity_method !== 'none' &&
                                                            set.intensity_method !== 'standard' && (
                                                                <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                                                                    {set.intensity_method}
                                                                </span>
                                                            )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEdit(set)}
                                                            className="ml-auto p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
                                                            title={t('history.editSet')}
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {we.notes && (
                                    <p className="mt-2 text-xs text-gray-500 italic">{we.notes}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
