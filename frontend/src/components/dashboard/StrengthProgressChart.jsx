import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Search, ChevronDown } from 'lucide-react';
import { queryKeys, fetchExercisesWithData, fetchTopsets, fetchProfile } from '../../lib/queries';
import { exName } from '../../lib/i18nUtils';
import { useDashboard, rangeToDays } from './DashboardContext';

function linearRegression(y) {
    const n = y.length;
    if (n < 2) return y.map(() => null);
    const xs = y.map((_, i) => i);
    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = y.reduce((s, v) => s + v, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * y[i], 0);
    const sumXX = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return y.map(() => null);
    const m = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    return xs.map(x => parseFloat((m * x + b).toFixed(2)));
}

const DARK_LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#9ca3af', family: 'sans-serif', size: 11 },
    xaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickcolor: '#374151', automargin: true },
    yaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickcolor: '#374151', automargin: true },
    margin: { t: 10, r: 10, b: 40, l: 55 },
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: '#9ca3af', size: 10 } },
    hovermode: 'x unified',
};

export default function StrengthProgressChart() {
    const { t, i18n } = useTranslation();
    const { dateRange } = useDashboard();
    const days = rangeToDays(dateRange);

    const [selectedExercise, setSelectedExercise] = useState('');
    const [plotType, setPlotType] = useState('topset');
    const [showTrend, setShowTrend] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    const { data: profile = { weight_unit: 'kg' } } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
        staleTime: 5 * 60 * 1000,
    });
    const convertWeight = (val) => profile.weight_unit === 'lbs' ? val * 2.20462 : val;

    const { data: exercises = [] } = useQuery({
        queryKey: queryKeys.exercisesWithData(),
        queryFn: fetchExercisesWithData,
        staleTime: 10 * 60 * 1000,
    });

    useEffect(() => {
        if (exercises.length > 0 && !selectedExercise) {
            const sorted = [...exercises].sort((a, b) =>
                exName(a, i18n.language).localeCompare(exName(b, i18n.language))
            );
            setSelectedExercise(sorted[0].id.toString());
        }
    }, [exercises, selectedExercise, i18n.language]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { data: plotData = { x: [], topset: [], max_weight: [], total_volume: [], has_intensity: [], est_1rm: [] }, isLoading } = useQuery({
        queryKey: queryKeys.topsets(selectedExercise),
        queryFn: () => fetchTopsets(selectedExercise),
        enabled: !!selectedExercise,
        staleTime: 60 * 1000,
    });

    // Filter by date range
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filteredIndices = plotData.x
        .map((d, i) => (d >= cutoffStr ? i : -1))
        .filter(i => i >= 0);

    const fx = filteredIndices.map(i => plotData.x[i]);
    const fIntensity = filteredIndices.map(i => plotData.has_intensity[i]);

    const rawY = {
        topset: filteredIndices.map(i => plotData.topset[i]),
        max_weight: filteredIndices.map(i => plotData.max_weight[i]),
        total_volume: filteredIndices.map(i => plotData.total_volume[i]),
        est_1rm: filteredIndices.map(i => plotData.est_1rm[i]),
    };

    const currentRaw = rawY[plotType] || rawY.topset;
    const currentY = currentRaw.map(v => v != null ? parseFloat(convertWeight(v).toFixed(2)) : null);

    // Detect PRs (new running max)
    const prIndices = [];
    let runningMax = -Infinity;
    currentY.forEach((v, i) => {
        if (v != null && v > runningMax) {
            runningMax = v;
            prIndices.push(i);
        }
    });

    const trendY = showTrend && currentY.filter(v => v != null).length >= 3
        ? linearRegression(currentY.filter(v => v != null))
        : null;

    const metricOptions = [
        { key: 'topset', label: t('dashboard.metric.topsetVolume') },
        { key: 'max_weight', label: t('dashboard.metric.maxWeight') },
        { key: 'total_volume', label: t('dashboard.metric.totalVolume') },
        { key: 'est_1rm', label: t('dashboard.metric.est1rm') },
    ];

    const yAxisLabel = {
        topset: t('graph.yAxisTopset'),
        max_weight: t('graph.yAxisMaxWeight'),
        total_volume: t('graph.yAxisTotalVolume'),
        est_1rm: `Est. 1RM (${profile.weight_unit})`,
    }[plotType];

    const traces = [];
    if (fx.length > 0) {
        traces.push({
            x: fx,
            y: currentY,
            type: 'scatter',
            mode: 'lines+markers',
            name: metricOptions.find(m => m.key === plotType)?.label,
            marker: {
                color: fIntensity.map(h => h ? '#ef4444' : '#6CB33E'),
                size: currentY.map((_, i) => prIndices.includes(i) ? 12 : 7),
                symbol: currentY.map((_, i) => prIndices.includes(i) ? 'star' : 'circle'),
                line: { color: fIntensity.map(h => h ? '#b91c1c' : '#3a6b1e'), width: 2 },
            },
            line: { color: '#6CB33E', width: 3, shape: 'spline', smoothing: 1.3 },
            fill: 'tozeroy',
            fillcolor: 'rgba(108,179,62,0.08)',
        });

        if (trendY) {
            const trendXs = fx.filter((_, i) => currentY[i] != null);
            traces.push({
                x: trendXs,
                y: trendY,
                type: 'scatter',
                mode: 'lines',
                name: t('dashboard.toggle.trendLine'),
                line: { color: 'rgba(251,191,36,0.6)', width: 2, dash: 'dash' },
                hoverinfo: 'skip',
            });
        }
    }

    const filteredExercises = exercises
        .filter(ex => {
            const q = searchQuery.toLowerCase();
            return ex.name.toLowerCase().includes(q) || (ex.name_pt && ex.name_pt.toLowerCase().includes(q));
        })
        .sort((a, b) => exName(a, i18n.language).localeCompare(exName(b, i18n.language)));

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.strengthProgress')}</h3>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Metric toggle */}
                    <div className="flex bg-gray-950 p-0.5 rounded-lg border border-gray-800 gap-0.5">
                        {metricOptions.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPlotType(key)}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    plotType === key ? 'bg-green-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Trend line toggle */}
                    <button
                        onClick={() => setShowTrend(p => !p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            showTrend
                                ? 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                                : 'border-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        <TrendingUp className="h-3 w-3" />
                        {t('dashboard.toggle.showTrend')}
                    </button>

                    {/* Exercise dropdown */}
                    <div className="min-w-[200px] relative" ref={dropdownRef}>
                        <div
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white cursor-pointer flex items-center justify-between text-sm"
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
                            <div className="absolute z-20 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                <div className="p-2 border-b border-gray-800">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input
                                            type="text"
                                            className="w-full pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                                            placeholder={t('workout.searchExercises')}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {filteredExercises.map(ex => (
                                        <div
                                            key={ex.id}
                                            className={`px-4 py-2.5 cursor-pointer hover:bg-gray-800 text-sm transition-colors ${
                                                selectedExercise === ex.id.toString() ? 'bg-green-600/20 text-green-400' : 'text-gray-300'
                                            }`}
                                            onClick={() => {
                                                setSelectedExercise(ex.id.toString());
                                                setIsDropdownOpen(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            {exName(ex, i18n.language)}
                                        </div>
                                    ))}
                                    {filteredExercises.length === 0 && (
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

            {/* Chart */}
            <div className="relative min-h-[280px] bg-gray-950 rounded-xl border border-gray-800 p-2">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
                    </div>
                ) : fx.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                        <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm">{t('graph.noData')}</p>
                    </div>
                ) : (
                    <Plot
                        data={traces}
                        layout={{
                            ...DARK_LAYOUT_BASE,
                            yaxis: {
                                ...DARK_LAYOUT_BASE.yaxis,
                                title: { text: yAxisLabel, font: { color: '#6b7280', size: 11 } },
                            },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: '280px' }}
                        useResizeHandler
                    />
                )}
            </div>

            {/* PR legend */}
            {prIndices.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span> PR marker
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Intensity technique
                    </span>
                </div>
            )}
        </div>
    );
}
