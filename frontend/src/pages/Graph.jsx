import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { TrendingUp, Filter } from 'lucide-react';
import api from '../api/axios';

function Graph() {
    const [exercises, setExercises] = useState([]);
    const [selectedExercise, setSelectedExercise] = useState('');
    const [plotData, setPlotData] = useState({ x: [], y: [] });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const response = await api.get('exercises/');
                setExercises(response.data);
            } catch (error) {
                console.error('Failed to fetch exercises', error);
            }
        };
        fetchExercises();
    }, []);

    useEffect(() => {
        const fetchTopsets = async () => {
            setIsLoading(true);
            try {
                const url = selectedExercise ? `topsets/?exercise_id=${selectedExercise}` : 'topsets/';
                const response = await api.get(url);
                const data = response.data.data;
                
                setPlotData({
                    x: data.map(d => d.date),
                    y: data.map(d => d.topset)
                });
            } catch (error) {
                console.error('Failed to fetch topsets', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTopsets();
    }, [selectedExercise]);

    return (
        <div className="max-w-5xl mx-auto font-sans">
            <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                <TrendingUp className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Progress Overview</h2>
                                <p className="text-sm text-gray-400">Track your topset volume over time.</p>
                            </div>
                        </div>
                        
                        <div className="min-w-[240px] relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Filter className="h-4 w-4 text-gray-500" />
                            </div>
                            <select 
                                className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none" 
                                value={selectedExercise} 
                                onChange={(e) => setSelectedExercise(e.target.value)}
                            >
                                <option value="">All Exercises</option>
                                {exercises.map(ex => (
                                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="w-full overflow-hidden bg-gray-950 rounded-2xl border border-gray-800 p-2 sm:p-4 relative min-h-[400px]">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
                                        y: plotData.y,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        marker: { 
                                            color: '#3b82f6', 
                                            size: 8,
                                            line: { color: '#1e3a8a', width: 2 }
                                        },
                                        line: { 
                                            color: '#3b82f6', 
                                            width: 3, 
                                            shape: 'spline',
                                            smoothing: 1.3
                                        },
                                        fill: 'tozeroy',
                                        fillcolor: 'rgba(59, 130, 246, 0.1)',
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
                                        title: { text: 'Volume (Weight × Reps)', font: { color: '#9ca3af', size: 12 } },
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
