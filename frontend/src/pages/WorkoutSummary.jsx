import React from 'react';
import { CheckCircle2, LineChart, RotateCcw, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/**
 * Session summary screen shown when the user finishes all exercises in a plan day.
 *
 * Props:
 *   date        — string, e.g. "2026-02-22"
 *   dayLabel    — string, e.g. "A"
 *   sessionLog  — array of { exerciseName, sets: [{weight, reps, reached_failure, intensity_method}] }
 *   onReset     — callback to reset the Workout page back to day selector
 */
function WorkoutSummary({ date, dayLabel, sessionLog, onReset }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

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
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5 mb-8">
                        <Calendar className="w-4 h-4" />
                        {date}
                        {dayLabel && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 text-xs font-semibold">
                                {dayLabel}
                            </span>
                        )}
                    </p>

                    {/* Exercise list */}
                    <div className="space-y-3 text-left mb-8">
                        {sessionLog.map((entry, i) => (
                            <div key={i} className="bg-gray-950 rounded-2xl border border-gray-800 p-4">
                                <p className="text-sm font-semibold text-white mb-2">{entry.exerciseName}</p>
                                <div className="flex flex-wrap gap-2">
                                    {entry.sets.map((s, j) => (
                                        <div key={j} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 rounded-xl border border-gray-800">
                                            <span className="text-xs font-bold text-gray-500">{j + 1}</span>
                                            <span className="text-xs text-white font-medium">
                                                {s.weight} <span className="text-gray-500">×</span> {s.reps}
                                            </span>
                                            {s.reached_failure && (
                                                <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">F</span>
                                            )}
                                            {s.intensity_method && s.intensity_method !== 'none' && (
                                                <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                                                    {s.intensity_method}
                                                </span>
                                            )}
                                        </div>
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
