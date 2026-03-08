import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { queryKeys, fetchHistory } from '../../lib/queries';
import { useDashboard, rangeToDays, getPlanDayColor } from './DashboardContext';

function rollingAvg(values, window = 4) {
    return values.map((_, i) => {
        const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter(v => v != null);
        if (!slice.length) return null;
        return parseFloat((slice.reduce((s, v) => s + v, 0) / slice.length).toFixed(1));
    });
}

export default function SessionDurationChart() {
    const { t } = useTranslation();
    const { dateRange } = useDashboard();
    const days = rangeToDays(dateRange);

    const { data: history = [], isLoading } = useQuery({
        queryKey: queryKeys.history(),
        queryFn: fetchHistory,
        staleTime: 2 * 60 * 1000,
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const sessions = [...history]
        .filter(s => s.date >= cutoffStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    const dates = sessions.map(s => s.date);
    const durations = sessions.map(s =>
        s.duration_seconds ? parseFloat((s.duration_seconds / 60).toFixed(1)) : null
    );
    const colors = sessions.map(s => getPlanDayColor(s.plan_day_label));
    const labels = sessions.map(s => s.plan_day_label || '?');

    const rolling = rollingAvg(durations.filter(v => v != null), 4);
    const rollingDates = dates.filter((_, i) => durations[i] != null);

    const hasDuration = durations.some(v => v != null);

    const hoverTexts = sessions.map(s => {
        const dur = s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} min` : 'N/A';
        const day = s.plan_day_label ? `Day ${s.plan_day_label}` : 'No plan';
        const exCount = s.exercises?.length ?? 0;
        return `${s.date}<br>${dur}<br>${day}<br>${exCount} exercise(s)`;
    });

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.sessionDuration')}</h3>
            </div>

            <div className="min-h-[220px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                    </div>
                ) : !hasDuration || sessions.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                        {t('dashboard.noData')}
                    </div>
                ) : (
                    <Plot
                        data={[
                            {
                                x: dates,
                                y: durations,
                                type: 'bar',
                                name: t('dashboard.kpi.avgDuration'),
                                marker: { color: colors, opacity: 0.85 },
                                text: labels,
                                hovertext: hoverTexts,
                                hoverinfo: 'text',
                            },
                            {
                                x: rollingDates,
                                y: rolling,
                                type: 'scatter',
                                mode: 'lines',
                                name: t('dashboard.charts.rollingAvg'),
                                line: { color: 'rgba(255,255,255,0.5)', width: 2, dash: 'dot' },
                                hoverinfo: 'skip',
                            },
                        ]}
                        layout={{
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af', family: 'sans-serif', size: 11 },
                            xaxis: { gridcolor: '#1f2937', linecolor: '#374151', tickcolor: '#374151', automargin: true, tickangle: -30 },
                            yaxis: {
                                gridcolor: '#1f2937',
                                linecolor: '#374151',
                                tickcolor: '#374151',
                                title: { text: t('dashboard.kpi.min'), font: { color: '#6b7280', size: 11 } },
                                automargin: true,
                            },
                            margin: { t: 10, r: 10, b: 55, l: 50 },
                            legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: '#9ca3af', size: 10 } },
                            barmode: 'group',
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: '220px' }}
                        useResizeHandler
                    />
                )}
            </div>

            {/* Color legend for plan days */}
            {sessions.some(s => s.plan_day_label) && (
                <div className="flex items-center flex-wrap gap-3">
                    {[...new Set(sessions.map(s => s.plan_day_label).filter(Boolean))].sort().map(label => (
                        <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: getPlanDayColor(label) }} />
                            Day {label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
