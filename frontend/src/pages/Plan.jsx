import React, { useState, useRef } from 'react';
import {
    ClipboardList, Plus, Trash2, GripVertical, Check, X, Search, ChevronDown, Pencil,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    queryKeys, fetchActivePlan, fetchExercises,
    createPlan, updatePlan, deletePlan,
    createPlanDay, deletePlanDay,
    createPlanExercise, updatePlanExercise, deletePlanExercise,
    reorderPlanExercises,
} from '../lib/queries';
import { exName } from '../lib/i18nUtils';

// ── Sortable exercise row ─────────────────────────────────────────────────────

function SortableExerciseRow({ pe, onDelete, onUpdate, lang, t }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pe.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const [editing, setEditing] = useState(false);
    const [localSets, setLocalSets] = useState(pe.target_sets);
    const [localMin, setLocalMin] = useState(pe.reps_min);
    const [localMax, setLocalMax] = useState(pe.reps_max);

    const handleSave = () => {
        onUpdate({ exId: pe.id, target_sets: Number(localSets), reps_min: Number(localMin), reps_max: Number(localMax) });
        setEditing(false);
    };

    return (
        <div ref={setNodeRef} style={style} className="group bg-gray-950 rounded-xl border border-gray-800 hover:border-gray-700 transition-all">
            <div className="flex items-center gap-3 px-4 py-4">
                {/* drag handle */}
                <button
                    className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
                    {...attributes}
                    {...listeners}
                    type="button"
                >
                    <GripVertical className="w-4 h-4" />
                </button>

                {/* exercise name */}
                <span className="flex-1 text-sm font-medium text-gray-200">
                    {exName(pe.exercise, lang)}
                </span>

                {editing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">{t('plan.targetSets')}</label>
                            <input
                                type="number" min="1"
                                className="w-14 px-2 py-1 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                value={localSets}
                                onChange={e => setLocalSets(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">{t('plan.repsMin')}</label>
                            <input
                                type="number" min="1"
                                className="w-14 px-2 py-1 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                value={localMin}
                                onChange={e => setLocalMin(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-500">{t('plan.repsMax')}</label>
                            <input
                                type="number" min="1"
                                className="w-14 px-2 py-1 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                value={localMax}
                                onChange={e => setLocalMax(e.target.value)}
                            />
                        </div>
                        <button type="button" onClick={handleSave}
                            className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors">
                            <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setEditing(false)}
                            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 hidden sm:inline">
                            {t('plan.target', { sets: pe.target_sets, min: pe.reps_min, max: pe.reps_max })}
                        </span>
                        <button type="button" onClick={() => setEditing(true)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100">
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => onDelete(pe.id)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            {/* target hint on mobile */}
            <div className="sm:hidden px-4 pb-2 text-xs text-gray-600">
                {t('plan.target', { sets: pe.target_sets, min: pe.reps_min, max: pe.reps_max })}
            </div>
        </div>
    );
}

// ── Main Plan page ────────────────────────────────────────────────────────────

function Plan() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();

    // ── State ─────────────────────────────────────────────────────────────────

    const [newPlanName, setNewPlanName] = useState('');
    const [editingPlanName, setEditingPlanName] = useState(false);
    const [planNameDraft, setPlanNameDraft] = useState('');
    const [activeDayId, setActiveDayId] = useState(null);

    // Add day
    const [addingDay, setAddingDay] = useState(false);
    const [newDayLabel, setNewDayLabel] = useState('');

    // Add exercise to day
    const [newExSearchQuery, setNewExSearchQuery] = useState('');
    const [newExDropdownOpen, setNewExDropdownOpen] = useState(false);
    const [selectedNewExId, setSelectedNewExId] = useState('');
    const [newExSets, setNewExSets] = useState(3);
    const [newExMin, setNewExMin] = useState(6);
    const [newExMax, setNewExMax] = useState(12);
    const exDropdownRef = useRef(null);

    // ── Queries ───────────────────────────────────────────────────────────────

    const { data: plan, isLoading: planLoading } = useQuery({
        queryKey: queryKeys.activePlan(),
        queryFn: fetchActivePlan,
        staleTime: 5 * 60 * 1000,
    });

    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercises(),
        queryFn: fetchExercises,
        staleTime: 10 * 60 * 1000,
    });

    // Close exercise dropdown on outside click
    React.useEffect(() => {
        const handler = (e) => {
            if (exDropdownRef.current && !exDropdownRef.current.contains(e.target)) {
                setNewExDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Set default active day when plan loads
    React.useEffect(() => {
        if (plan && plan.days.length > 0 && !activeDayId) {
            setActiveDayId(plan.days[0].id);
        }
    }, [plan, activeDayId]);

    // ── Mutations ─────────────────────────────────────────────────────────────

    const createPlanMutation = useMutation({
        mutationFn: createPlan,
        onSuccess: (newPlan) => {
            queryClient.setQueryData(queryKeys.activePlan(), newPlan);
            setNewPlanName('');
        },
        onError: () => alert(t('plan.createPlanFailed')),
    });

    const updatePlanMutation = useMutation({
        mutationFn: updatePlan,
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKeys.activePlan(), old => old ? { ...old, ...updated } : old);
            setEditingPlanName(false);
        },
    });

    const deletePlanMutation = useMutation({
        mutationFn: deletePlan,
        onSuccess: () => {
            queryClient.setQueryData(queryKeys.activePlan(), null);
            setActiveDayId(null);
        },
    });

    const createDayMutation = useMutation({
        mutationFn: createPlanDay,
        onSuccess: (newDay) => {
            queryClient.setQueryData(queryKeys.activePlan(), old =>
                old ? { ...old, days: [...old.days, { ...newDay, exercises: [] }] } : old
            );
            setActiveDayId(newDay.id);
            setAddingDay(false);
            setNewDayLabel('');
        },
    });

    const deleteDayMutation = useMutation({
        mutationFn: deletePlanDay,
        onSuccess: (_, { dayId }) => {
            queryClient.setQueryData(queryKeys.activePlan(), old =>
                old ? { ...old, days: old.days.filter(d => d.id !== dayId) } : old
            );
            setActiveDayId(null);
        },
    });

    const createExerciseMutation = useMutation({
        mutationFn: createPlanExercise,
        onSuccess: (newPe) => {
            queryClient.setQueryData(queryKeys.activePlan(), old => {
                if (!old) return old;
                return {
                    ...old,
                    days: old.days.map(d =>
                        d.id === activeDayId ? { ...d, exercises: [...d.exercises, newPe] } : d
                    ),
                };
            });
            setSelectedNewExId('');
            setNewExSearchQuery('');
            setNewExSets(3);
            setNewExMin(6);
            setNewExMax(12);
        },
    });

    const updateExerciseMutation = useMutation({
        mutationFn: (vars) => updatePlanExercise({ planId: plan.id, dayId: activeDayId, ...vars }),
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKeys.activePlan(), old => {
                if (!old) return old;
                return {
                    ...old,
                    days: old.days.map(d =>
                        d.id === activeDayId
                            ? { ...d, exercises: d.exercises.map(pe => pe.id === updated.id ? updated : pe) }
                            : d
                    ),
                };
            });
        },
    });

    const deleteExerciseMutation = useMutation({
        mutationFn: (exId) => deletePlanExercise({ planId: plan.id, dayId: activeDayId, exId }),
        onSuccess: (_, exId) => {
            queryClient.setQueryData(queryKeys.activePlan(), old => {
                if (!old) return old;
                return {
                    ...old,
                    days: old.days.map(d =>
                        d.id === activeDayId
                            ? { ...d, exercises: d.exercises.filter(pe => pe.id !== exId) }
                            : d
                    ),
                };
            });
        },
    });

    const reorderMutation = useMutation({
        mutationFn: (items) => reorderPlanExercises({ planId: plan.id, dayId: activeDayId, items }),
        // Optimistic update already applied in handleDragEnd; confirm with server values
        onSuccess: (reordered) => {
            queryClient.setQueryData(queryKeys.activePlan(), old => {
                if (!old) return old;
                return {
                    ...old,
                    days: old.days.map(d =>
                        d.id === activeDayId ? { ...d, exercises: reordered } : d
                    ),
                };
            });
        },
    });

    // ── DnD sensors ──────────────────────────────────────────────────────────

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // ── Derived ───────────────────────────────────────────────────────────────

    const activeDay = plan?.days.find(d => d.id === activeDayId) ?? null;

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !activeDay) return;

        const oldIndex = activeDay.exercises.findIndex(pe => pe.id === active.id);
        const newIndex = activeDay.exercises.findIndex(pe => pe.id === over.id);
        const reordered = arrayMove(activeDay.exercises, oldIndex, newIndex);

        // Optimistic update
        queryClient.setQueryData(queryKeys.activePlan(), old => {
            if (!old) return old;
            return {
                ...old,
                days: old.days.map(d =>
                    d.id === activeDayId
                        ? { ...d, exercises: reordered.map((pe, i) => ({ ...pe, order: i })) }
                        : d
                ),
            };
        });

        reorderMutation.mutate(reordered.map((pe, i) => ({ id: pe.id, order: i })));
    };

    const handleDeleteDay = (day) => {
        if (!window.confirm(t('plan.deleteDayConfirm', { label: day.label }))) return;
        deleteDayMutation.mutate({ planId: plan.id, dayId: day.id });
    };

    const handleDeleteExercise = (exId) => {
        if (!window.confirm(t('plan.deleteExerciseConfirm'))) return;
        deleteExerciseMutation.mutate(exId);
    };

    const handleAddExercise = () => {
        if (!selectedNewExId || !activeDayId) return;
        createExerciseMutation.mutate({
            planId: plan.id,
            dayId: activeDayId,
            exercise_id: Number(selectedNewExId),
            target_sets: Number(newExSets),
            reps_min: Number(newExMin),
            reps_max: Number(newExMax),
        });
    };

    // ── Render: no plan ───────────────────────────────────────────────────────

    if (planLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="max-w-2xl mx-auto font-sans">
                <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl p-10 text-center">
                    <div className="h-16 w-16 bg-green-600/10 rounded-2xl flex items-center justify-center border border-green-500/20 mx-auto mb-6">
                        <ClipboardList className="h-8 w-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t('plan.title')}</h2>
                    <p className="text-gray-400 mb-8">{t('plan.noPlan')}</p>
                    <div className="flex gap-3 max-w-sm mx-auto">
                        <input
                            type="text"
                            className="flex-1 px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                            placeholder={t('plan.planNamePlaceholder')}
                            value={newPlanName}
                            onChange={e => setNewPlanName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && newPlanName.trim() && createPlanMutation.mutate({ name: newPlanName.trim() })}
                        />
                        <button
                            type="button"
                            disabled={!newPlanName.trim() || createPlanMutation.isPending}
                            onClick={() => createPlanMutation.mutate({ name: newPlanName.trim() })}
                            className="px-5 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {createPlanMutation.isPending ? t('plan.saving') : t('plan.createPlan')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render: plan exists ───────────────────────────────────────────────────

    return (
        <div className="max-w-4xl mx-auto font-sans space-y-6">
            {/* Header */}
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl px-6 py-8 sm:p-10">
                <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20 flex-shrink-0">
                            <ClipboardList className="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                            {editingPlanName ? (
                                <div className="flex gap-2 items-center">
                                    <input
                                        autoFocus
                                        className="px-3 py-1 bg-gray-950 border border-gray-700 rounded-xl text-white text-xl font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                        value={planNameDraft}
                                        onChange={e => setPlanNameDraft(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && planNameDraft.trim()) updatePlanMutation.mutate({ id: plan.id, name: planNameDraft.trim() });
                                            if (e.key === 'Escape') setEditingPlanName(false);
                                        }}
                                    />
                                    <button type="button"
                                        onClick={() => planNameDraft.trim() && updatePlanMutation.mutate({ id: plan.id, name: planNameDraft.trim() })}
                                        className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setEditingPlanName(false)}
                                        className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="flex items-center gap-2 group"
                                    onClick={() => { setPlanNameDraft(plan.name); setEditingPlanName(true); }}
                                >
                                    <h2 className="text-2xl font-bold text-white tracking-tight">{plan.name}</h2>
                                    <Pencil className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors" />
                                </button>
                            )}
                            <p className="text-sm text-gray-400 mt-0.5">{t('plan.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => { if (window.confirm('Delete this entire plan?')) deletePlanMutation.mutate(plan.id); }}
                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors flex-shrink-0"
                        title="Delete plan"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Day tabs + content */}
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl">
                {/* Tab bar */}
                <div className="flex items-center gap-1 px-4 pt-4 border-b border-gray-800 overflow-x-auto pb-0">
                    {plan.days.map(day => (
                        <button
                            key={day.id}
                            type="button"
                            onClick={() => setActiveDayId(day.id)}
                            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex items-center gap-2
                                ${activeDayId === day.id
                                    ? 'bg-gray-800 text-white border border-b-gray-800 border-gray-700 -mb-px'
                                    : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {day.label}
                        </button>
                    ))}

                    {/* Add day button */}
                    {addingDay ? (
                        <div className="flex items-center gap-1 px-2 pb-px">
                            <input
                                autoFocus
                                className="w-24 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none uppercase"
                                placeholder={t('plan.dayLabelPlaceholder')}
                                value={newDayLabel}
                                maxLength={10}
                                onChange={e => setNewDayLabel(e.target.value.toUpperCase())}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && newDayLabel.trim()) createDayMutation.mutate({ planId: plan.id, label: newDayLabel.trim() });
                                    if (e.key === 'Escape') { setAddingDay(false); setNewDayLabel(''); }
                                }}
                            />
                            <button type="button"
                                onClick={() => newDayLabel.trim() && createDayMutation.mutate({ planId: plan.id, label: newDayLabel.trim() })}
                                className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors">
                                <Check className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => { setAddingDay(false); setNewDayLabel(''); }}
                                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setAddingDay(true)}
                            className="ml-1 px-3 py-2 text-sm text-gray-500 hover:text-green-400 flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> {t('plan.addDay')}
                        </button>
                    )}
                </div>

                {/* Day content */}
                {activeDay ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-500">
                                {activeDay.exercises.length === 0
                                    ? t('plan.noExercisesInDay')
                                    : `${activeDay.exercises.length} exercise${activeDay.exercises.length !== 1 ? 's' : ''}`}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleDeleteDay(activeDay)}
                                className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Delete day
                            </button>
                        </div>

                        {/* Sortable exercise list */}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext
                                items={activeDay.exercises.map(pe => pe.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {activeDay.exercises.map(pe => (
                                        <SortableExerciseRow
                                            key={pe.id}
                                            pe={pe}
                                            lang={i18n.language}
                                            t={t}
                                            onDelete={handleDeleteExercise}
                                            onUpdate={({ exId, ...fields }) => updateExerciseMutation.mutate({ exId, ...fields })}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        {/* Add exercise form */}
                        <div className="mt-6 border-t border-gray-800 pt-6">
                            <div className="flex flex-wrap gap-4 items-end">
                                {/* Exercise searchable dropdown */}
                                <div className="flex-1 min-w-[220px] relative" ref={exDropdownRef}>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('workout.exercise')}</label>
                                    <div
                                        className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white cursor-pointer flex items-center justify-between"
                                        onClick={() => setNewExDropdownOpen(o => !o)}
                                    >
                                        <span className={selectedNewExId ? 'text-white' : 'text-gray-500'}>
                                            {selectedNewExId
                                                ? exName(exercises.find(e => e.id === Number(selectedNewExId)), i18n.language)
                                                : t('workout.selectExercise')}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${newExDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                    {newExDropdownOpen && (
                                        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                            <div className="p-2 border-b border-gray-800">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                                        placeholder={t('workout.searchExercises')}
                                                        value={newExSearchQuery}
                                                        onChange={e => setNewExSearchQuery(e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {exercises
                                                    .filter(ex => {
                                                        const q = newExSearchQuery.toLowerCase();
                                                        return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
                                                    })
                                                    .map(ex => (
                                                        <div
                                                            key={ex.id}
                                                            className={`px-4 py-2.5 cursor-pointer hover:bg-gray-800 text-sm transition-colors
                                                                ${selectedNewExId === ex.id.toString() ? 'bg-green-600/20 text-green-400' : 'text-gray-300'}`}
                                                            onClick={() => { setSelectedNewExId(ex.id.toString()); setNewExDropdownOpen(false); setNewExSearchQuery(''); }}
                                                        >
                                                            {exName(ex, i18n.language)}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sets */}
                                <div className="w-20">
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('plan.targetSets')}</label>
                                    <input type="number" min="1"
                                        className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                        value={newExSets}
                                        onChange={e => setNewExSets(e.target.value)}
                                    />
                                </div>

                                {/* Min reps */}
                                <div className="w-24">
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('plan.repsMin')}</label>
                                    <input type="number" min="1"
                                        className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                        value={newExMin}
                                        onChange={e => setNewExMin(e.target.value)}
                                    />
                                </div>

                                {/* Max reps */}
                                <div className="w-24">
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('plan.repsMax')}</label>
                                    <input type="number" min="1"
                                        className="w-full px-3 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-green-500 outline-none"
                                        value={newExMax}
                                        onChange={e => setNewExMax(e.target.value)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    disabled={!selectedNewExId || createExerciseMutation.isPending}
                                    onClick={handleAddExercise}
                                    className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" /> {t('plan.addExercise')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-10 text-center text-gray-600 text-sm">
                        {plan.days.length === 0 ? t('plan.addDay') + ' to get started.' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Plan;
