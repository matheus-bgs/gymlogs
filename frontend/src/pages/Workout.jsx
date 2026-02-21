import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Calendar, Activity, FileText, X, Search, ChevronDown } from 'lucide-react';
import api from '../api/axios';

function Workout() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [exercise, setExercise] = useState('');
    const [isCreatingExercise, setIsCreatingExercise] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    const [notes, setNotes] = useState('');
    const [sets, setSets] = useState([{ order: 1, weight: '', reps: '', reached_failure: false, intensity_method: 'none' }]);
    const [exercises, setExercises] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastWorkout, setLastWorkout] = useState(null);
    const [isLoadingLastWorkout, setIsLoadingLastWorkout] = useState(false);

    // Searchable select state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    const navigate = useNavigate();

    const fetchExercises = async () => {
        try {
            const response = await api.get('exercises/');
            setExercises(response.data);
        } catch (error) {
            console.error('Failed to fetch exercises', error);
        }
    };

    useEffect(() => {
        fetchExercises();
    }, []);

    useEffect(() => {
        const fetchLastWorkout = async () => {
            if (!exercise) {
                setLastWorkout(null);
                return;
            }

            setIsLoadingLastWorkout(true);
            try {
                const response = await api.get(`workouts/last/?exercise_id=${exercise}`);
                setLastWorkout(response.data.data);
            } catch (error) {
                console.error('Failed to fetch last workout', error);
                setLastWorkout(null);
            } finally {
                setIsLoadingLastWorkout(false);
            }
        };

        fetchLastWorkout();
    }, [exercise]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateExercise = async () => {
        if (!newExerciseName.trim()) return;

        try {
            const response = await api.post('exercises/', { name: newExerciseName.trim() });
            await fetchExercises();
            setExercise(response.data.id);
            setIsCreatingExercise(false);
            setNewExerciseName('');
        } catch (error) {
            console.error('Failed to create exercise', error);
            alert('Failed to create exercise. It might already exist.');
        }
    };

    const handleAddSet = () => {
        setSets([...sets, {
            order: sets.length + 1,
            weight: '',
            reps: '',
            reached_failure: false,
            intensity_method: 'none'
        }]);
    };

    const handleRemoveSet = (indexToRemove) => {
        const newSets = sets.filter((_, index) => index !== indexToRemove).map((set, index) => ({
            ...set,
            order: index + 1
        }));
        setSets(newSets);
    };

    const handleSetChange = (index, field, value) => {
        const newSets = [...sets];
        newSets[index][field] = value;
        setSets(newSets);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (sets.length === 0) {
            alert('Please add at least one set.');
            return;
        }
        if (!exercise) {
            alert('Please select an exercise.');
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post('workouts/', {
                date,
                exercise,
                notes,
                sets
            });
            navigate('/graph');
        } catch (error) {
            console.error('Failed to submit workout', error);
            alert('Failed to submit workout');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto font-sans">
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-12 w-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <Activity className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Log Workout</h2>
                            <p className="text-sm text-gray-400">Record your sets, reps, and intensity.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Top section: Date, Exercise, Notes */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                    <Calendar className="w-4 h-4 text-gray-500" /> Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center justify-between text-sm font-medium text-gray-300">
                                    <span className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-gray-500" /> Exercise
                                    </span>
                                    {!isCreatingExercise && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingExercise(true)}
                                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> New
                                        </button>
                                    )}
                                </label>

                                {isCreatingExercise ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            placeholder="Exercise name..."
                                            value={newExerciseName}
                                            onChange={(e) => setNewExerciseName(e.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCreateExercise}
                                            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCreatingExercise(false);
                                                setNewExerciseName('');
                                            }}
                                            className="px-3 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative" ref={dropdownRef}>
                                        <div
                                            className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all cursor-pointer flex items-center justify-between"
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        >
                                            <span className={exercise ? "text-white" : "text-gray-500"}>
                                                {exercise ? exercises.find(e => e.id === parseInt(exercise))?.name : "Select an exercise"}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isDropdownOpen && (
                                            <div className="absolute z-10 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                                <div className="p-2 border-b border-gray-800">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                        <input
                                                            type="text"
                                                            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                            placeholder="Search exercises..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {exercises
                                                        .filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map(ex => (
                                                            <div
                                                                key={ex.id}
                                                                className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm ${exercise === ex.id.toString() ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300'}`}
                                                                onClick={() => {
                                                                    setExercise(ex.id.toString());
                                                                    setIsDropdownOpen(false);
                                                                    setSearchQuery('');
                                                                }}
                                                            >
                                                                {ex.name}
                                                            </div>
                                                        ))}
                                                    {exercises.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                            No exercises found
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
                                    <FileText className="w-4 h-4 text-gray-500" /> Notes
                                </label>
                                <textarea
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    rows="2"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="How did it feel? Any pain or PRs?"
                                    disabled={!exercise}
                                />
                            </div>
                        </div>

                        {/* Last Workout Info */}
                        {exercise && (
                            <div className="pt-6 border-t border-gray-800">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-500" /> Last Workout
                                </h3>
                                {isLoadingLastWorkout ? (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : lastWorkout ? (
                                    <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                                <Calendar className="w-4 h-4" /> {lastWorkout.date}
                                            </span>
                                        </div>
                                        {lastWorkout.notes && (
                                            <p className="text-sm text-gray-300 mb-4 italic border-l-2 border-blue-500 pl-3 py-1 bg-blue-500/5 rounded-r-lg">
                                                "{lastWorkout.notes}"
                                            </p>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {lastWorkout.sets.map((set, idx) => (
                                                <div key={idx} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-500 bg-gray-800 w-6 h-6 rounded-full flex items-center justify-center">
                                                        {set.order}
                                                    </span>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-bold text-white">
                                                            {set.weight} <span className="text-xs text-gray-400 font-normal">kg</span> × {set.reps}
                                                        </span>
                                                        <div className="flex gap-1 mt-1">
                                                            {set.intensity_method !== 'none' && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                                                                    {set.intensity_method}
                                                                </span>
                                                            )}
                                                            {set.reached_failure && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                                                                    Failure
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800 text-center">
                                        <p className="text-sm text-gray-500">No previous workout found for this exercise.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sets section */}
                        <div className="pt-6 border-t border-gray-800">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Working Sets</h3>
                                <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full">{sets.length} sets total</span>
                            </div>

                            <div className="space-y-4">
                                {sets.map((set, index) => (
                                    <div key={index} className={`group bg-gray-950 rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all flex flex-wrap items-end gap-4 relative ${!exercise ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="absolute -left-3 -top-3 w-8 h-8 bg-gray-800 text-gray-300 rounded-full flex items-center justify-center font-bold text-sm border border-gray-700 shadow-sm">
                                            {set.order}
                                        </div>

                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Weight (kg/lbs)</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                required
                                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                value={set.weight}
                                                onChange={(e) => handleSetChange(index, 'weight', parseFloat(e.target.value))}
                                                placeholder="0.0"
                                                disabled={!exercise}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[100px]">
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Reps</label>
                                            <input
                                                type="number"
                                                required
                                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                value={set.reps}
                                                onChange={(e) => handleSetChange(index, 'reps', parseInt(e.target.value))}
                                                placeholder="0"
                                                disabled={!exercise}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[140px]">
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Intensity Method</label>
                                            <select
                                                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                value={set.intensity_method}
                                                onChange={(e) => handleSetChange(index, 'intensity_method', e.target.value)}
                                                disabled={!exercise}
                                            >
                                                <option value="none">Standard</option>
                                                <option value="myoreps">Myo-reps</option>
                                                <option value="dropset">Drop Set</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center h-[46px] px-2">
                                            <label className={`flex items-center gap-3 ${!exercise ? 'cursor-not-allowed' : 'cursor-pointer'} group/check`}>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="peer sr-only"
                                                        checked={set.reached_failure}
                                                        onChange={(e) => handleSetChange(index, 'reached_failure', e.target.checked)}
                                                        disabled={!exercise}
                                                    />
                                                    <div className="w-6 h-6 bg-gray-900 border-2 border-gray-700 rounded-md peer-checked:bg-red-500 peer-checked:border-red-500 transition-all flex items-center justify-center">
                                                        <svg className={`w-4 h-4 text-white ${set.reached_failure ? 'opacity-100' : 'opacity-0'} transition-opacity`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-medium transition-colors ${set.reached_failure ? 'text-red-400' : 'text-gray-400 group-hover/check:text-gray-300'}`}>
                                                    Failure
                                                </span>
                                            </label>
                                        </div>
                                        {sets.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSet(index)}
                                                className="h-[46px] px-3 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Remove set"
                                                disabled={!exercise}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleAddSet}
                                className="mt-6 w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-700 disabled:hover:text-gray-400"
                                disabled={!exercise}
                            >
                                <Plus className="w-5 h-5" /> Add Another Set
                            </button>
                        </div>

                        <div className="pt-8 border-t border-gray-800">
                            <button
                                type="submit"
                                disabled={isSubmitting || !exercise}
                                className="w-full py-4 px-4 rounded-2xl shadow-lg shadow-blue-600/20 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Saving...' : (
                                    <>
                                        <Save className="w-5 h-5" /> Save Workout
                                    </>
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
