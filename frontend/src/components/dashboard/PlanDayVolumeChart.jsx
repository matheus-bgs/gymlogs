import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Activity } from 'lucide-react';
import { queryKeys, fetchHistory } from '../../lib/queries';
import { useDashboard, rangeToDays, getPlanDayColor } from './DashboardContext';

function computeVolumeByDay(sessions, metric) {
    const dayMap = {};
    for (const s of sessions) {
        const label = s.plan_day_label || 'None';
        if (!dayMap[label]) dayMap[label] = { totalTonnage: 0, totalSets: 0, totalReps: 0, count: 0 };
        dayMap[label].count += 1;
        for (const ex of s.exercises || []) {
            for (const set of ex.sets || []) {
                dayMap[label].totalTonnage += set.weight * set.reps;
                dayMap[label].totalSets += 1;
                dayMap[label].totalReps += set.reps;
            }
        }
    }
    const result = {};
    for (const [label, d] of Object.entries(dayMap)) {
        if (d.count === 0) continue;
        result[label] = {
            tonnage: d.totalTonnage / d.count,
            sets: d.totalSets / d.count,
            reps: d.totalReps / d.count,
        };
    }
    return result;
}

export default function PlanDayVolumeChart() {
    const { t } = useTranslation();
    const { dateRange } = useDashboard();
    const days = rangeToDays(dateRange);
    const [metric, setMetric] = useState('tonnage');

    const { data: history = [], isLoading } = useQuery({
        queryKey: queryKeys.history(),
        queryFn: fetchHistory,
        staleTime: 2 * 60 * 1000,
    });

    const today = new Date();
    const cutCurrentStr = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
    const cutPriorStr = new Date(today.getTime() - 2 * days * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const currentSessions = history.filter(s => s.date >= cutCurrentStr && s.date <= todayStr);
    const priorSessions = history.filter(s => s.date >= cutPriorStr && s.date < cutCurrentStr);

    const currentVol = computeVolumeByDay(currentSessions, metric);
    const priorVol = computeVolumeByDay(priorSessions, metric);

    const allLabels = [...new Set([...Object.keys(currentVol), ...Object.keys(priorVol)])].sort();

    const getVal = (volMap, label) => {
        const entry = volMap[label];
        if (!entry) return 0;
        return metric === 'tonnage' ? Math.round(entry.tonnage)
            : metric === 'sets' ? parseFloat(entry.sets.toFixed(1))
            : parseFloat(entry.reps.toFixed(1));
    };

    const toggle = [
        { key: 'tonnage', label: t('dashboard.toggle.tonnage') },
        { key: 'sets', label: t('dashboard.toggle.sets') },
        { key: 'reps', label: t('dashboard.toggle.reps') },
    ];

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.planDayVolume')}</h3>
                </div>
                <div className="flex bg-gray-950 p-0.5 rounded-lg border border-gray-800 gap-0.5">
                    {toggle.map(({ key, label }) => (
                        <button key={key} onClick={() => setMetric(key)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${metric === key ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-h-[220px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                    </div>
                ) : allLabels.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                        {t('dashboard.noData')}
                    </div>
                ) : (
                    <Plot
                        data={[
                            {
                                x: allLabels,
                                y: allLabels.map(l => getVal(currentVol, l)),
                                type: 'bar',
                                name: t('dashboard.current'),
                                marker: { color: allLabels.map(l => getPlanDayColor(l === 'None' ? null : l)), opacity: 0.9 },
                                hovertemplate: `<b>%{x}</b> (current)<br>%{y:.1f}<extra></extra>`,
                            },
                            {
                                x: allLabels,
                                y: allLabels.map(l => getVal(priorVol, l)),
                                type: 'bar',
                                name: t('dashboard.prior'),
                                marker: { color: allLabels.map(l => getPlanDayColor(l === 'None' ? null : l)), opacity: 0.35 },
                                hovertemplate: `<b>%{x}</b> (prior)<br>%{y:.1f}<extra></extra>`,
                            },
                        ]}
                        layout={{
                            barmode: 'group',
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af', family: 'sans-serif', size: 11 },
                            xaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickcolor: '#374151', automargin: true, title: { text: 'Plan Day', font: { color: '#6b7280', size: 11 } } },
                            yaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickcolor: '#374151', title: { text: t(`dashboard.toggle.${metric}`), font: { color: '#6b7280', size: 11 } }, automargin: true },
                            margin: { t: 10, r: 10, b: 50, l: 55 },
                            legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: '#9ca3af', size: 10 } },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: '220px' }}
                        useResizeHandler
                    />
                )}
            </div>
        </div>
    );
}
