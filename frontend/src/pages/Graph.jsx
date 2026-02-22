import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { TrendingUp, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchExercises, fetchTopsets } from '../lib/queries';

function Graph() {
    const [selectedExercise, setSelectedExercise] = useState('');
    const [plotType, setPlotType] = useState('topset'); // 'topset', 'max_weight', or 'total_volume'

    // ── Queries ────────────────────────────────────────────────────────────────

    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercises(),
        queryFn: fetchExercises,
        staleTime: 10 * 60 * 1000,
    });

    // Auto-select first exercise once list is loaded
    useEffect(() => {
        if (exercises.length > 0 && !selectedExercise) {
            setSelectedExercise(exercises[0].id.toString());
        }
    }, [exercises, selectedExercise]);

    const { data: plotData = { x: [], topset: [], max_weight: [], total_volume: [], has_intensity: [] }, isLoading } = useQuery({
        queryKey: queryKeys.topsets(selectedExercise),
        queryFn: () => fetchTopsets(selectedExercise),
        enabled: !!selectedExercise,
        staleTime: 60 * 1000, // 1 minute — invalidated after a new workout is saved
    });

    return (
        <div className="max-w-5xl mx-auto font-sans">
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20">
                                <TrendingUp className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Progress Overview</h2>
                                <p className="text-sm text-gray-400">Track your progress over time.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                                <button
                                    onClick={() => setPlotType('topset')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'topset' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Topset Volume
                                </button>
                                <button
                                    onClick={() => setPlotType('max_weight')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'max_weight' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Max Weight
                                </button>
                                <button
                                    onClick={() => setPlotType('total_volume')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'total_volume' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Total Volume
                                </button>
                            </div>

                            <div className="min-w-[240px] relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-500" />
                                </div>
                                <select
                                    className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all appearance-none"
                                    value={selectedExercise}
                                    onChange={(e) => setSelectedExercise(e.target.value)}
                                >
                                    {exercises.map(ex => (
                                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="w-full overflow-hidden bg-gray-950 rounded-2xl border border-gray-800 p-2 sm:p-4 relative min-h-[400px]">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                            </div>
                        ) : plotData.x.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                                <p>No data available for this selection.</p>
                            </div>
                        ) : (
                            <Plot
                                data={[
                                    {
                                        x: plotData.x,
                                        y: plotType === 'topset' ? plotData.topset : plotType === 'max_weight' ? plotData.max_weight : plotData.total_volume,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        marker: {
                                            color: plotData.has_intensity.map(has => has ? '#ef4444' : '#6CB33E'),
                                            size: 8,
                                            line: {
                                                color: plotData.has_intensity.map(has => has ? '#b91c1c' : '#3a6b1e'),
                                                width: 2
                                            }
                                        },
                                        line: {
                                            color: '#6CB33E',
                                            width: 3,
                                            shape: 'spline',
                                            smoothing: 1.3
                                        },
                                        fill: 'tozeroy',
                                        fillcolor: 'rgba(108, 179, 62, 0.1)',
                                    },
                                ]}
                                layout={{
                                    autosize: true,
                                    height: 450,
                                    margin: { t: 20, r: 20, l: 50, b: 40 },
                                    paper_bgcolor: 'transparent',
                                    plot_bgcolor: 'transparent',
                                    font: { color: '#9ca3af', family: 'Inter, sans-serif' },
                                    xaxis: {
                                        gridcolor: '#1f2937',
                                        zerolinecolor: '#1f2937',
                                        tickfont: { color: '#6b7280' },
                                        showgrid: true,
                                    },
                                    yaxis: {
                                        gridcolor: '#1f2937',
                                        zerolinecolor: '#1f2937',
                                        tickfont: { color: '#6b7280' },
                                        title: {
                                            text: plotType === 'topset' ? 'Topset Volume (Weight × Reps)' : plotType === 'max_weight' ? 'Max Weight (kg)' : 'Total Volume (kg)',
                                            font: { color: '#9ca3af', size: 12 }
                                        },
                                        showgrid: true,
                                    },
                                    hovermode: 'closest',
                                    hoverlabel: {
                                        bgcolor: '#111827',
                                        bordercolor: '#374151',
                                        font: { color: '#f3f4f6', family: 'Inter, sans-serif' }
                                    }
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Graph;
