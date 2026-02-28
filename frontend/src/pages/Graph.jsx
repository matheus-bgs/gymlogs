import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { TrendingUp, Search, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchExercisesWithData, fetchTopsets, fetchProfile } from '../lib/queries';
import { exName } from '../lib/i18nUtils';

function Graph() {
    const [selectedExercise, setSelectedExercise] = useState('');
    const [plotType, setPlotType] = useState('topset'); // 'topset', 'max_weight', or 'total_volume'
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);
    const { t, i18n } = useTranslation();

    const { data: profile = { weight_unit: 'kg' } } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
        staleTime: 5 * 60 * 1000,
    });
    const weightUnit = profile.weight_unit;
    const convertWeight = (val) => weightUnit === 'lbs' ? val * 2.20462 : val;

    // ── Queries ────────────────────────────────────────────────────────────────

    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercisesWithData(),
        queryFn: fetchExercisesWithData,
        staleTime: 10 * 60 * 1000,
    });

    // Auto-select first exercise (alphabetical) once list is loaded
    useEffect(() => {
        if (exercises.length > 0 && !selectedExercise) {
            const sorted = [...exercises].sort((a, b) =>
                exName(a, i18n.language).localeCompare(exName(b, i18n.language))
            );
            setSelectedExercise(sorted[0].id.toString());
        }
    }, [exercises, selectedExercise]);

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
                                <h2 className="text-2xl font-bold text-white tracking-tight">{t('graph.title')}</h2>
                                <p className="text-sm text-gray-400">{t('graph.subtitle')}</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800">
                                <button
                                    onClick={() => setPlotType('topset')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'topset' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    {t('graph.topsetVolume')}
                                </button>
                                <button
                                    onClick={() => setPlotType('max_weight')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'max_weight' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    {t('graph.maxWeight')}
                                </button>
                                <button
                                    onClick={() => setPlotType('total_volume')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${plotType === 'total_volume' ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    {t('graph.totalVolume')}
                                </button>
                            </div>

                            <div className="min-w-[240px] relative" ref={dropdownRef}>
                                <div
                                    className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition-all cursor-pointer flex items-center justify-between"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <span className={selectedExercise ? 'text-white' : 'text-gray-500'}>
                                        {selectedExercise
                                            ? exName(exercises.find(e => e.id === parseInt(selectedExercise)), i18n.language)
                                            : '—'}
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
                                                    className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                                    placeholder={t('workout.searchExercises')}
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {exercises
                                                .filter(ex => {
                                                    const q = searchQuery.toLowerCase();
                                                    return ex.name.toLowerCase().includes(q) ||
                                                        (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
                                                })
                                                .sort((a, b) => exName(a, i18n.language).localeCompare(exName(b, i18n.language)))
                                                .map(ex => (
                                                    <div
                                                        key={ex.id}
                                                        className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors text-sm ${selectedExercise === ex.id.toString() ? 'bg-green-600/20 text-green-400' : 'text-gray-300'}`}
                                                        onClick={() => {
                                                            setSelectedExercise(ex.id.toString());
                                                            setIsDropdownOpen(false);
                                                            setSearchQuery('');
                                                        }}
                                                    >
                                                        {exName(ex, i18n.language)}
                                                    </div>
                                                ))}
                                            {exercises.filter(ex => {
                                                const q = searchQuery.toLowerCase();
                                                return ex.name.toLowerCase().includes(q) ||
                                                    (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
                                            }).length === 0 && (
                                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                        {t('workout.noExercisesFound')}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                )}
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
                                <p>{t('graph.noData')}</p>
                            </div>
                        ) : (
                            <Plot
                                data={[
                                    {
                                        x: plotData.x,
                                        y: (plotType === 'topset' ? plotData.topset : plotType === 'max_weight' ? plotData.max_weight : plotData.total_volume).map(convertWeight),
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
                                            text: plotType === 'topset'
                                                ? `${t('graph.yAxisTopset')} (${weightUnit})`
                                                : plotType === 'max_weight'
                                                    ? `${t('graph.yAxisMaxWeight')} (${weightUnit})`
                                                    : `${t('graph.yAxisTotalVolume')} (${weightUnit})`,
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
