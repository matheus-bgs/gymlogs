import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart2 } from 'lucide-react';
import { queryKeys, fetchVolumeByMuscle } from '../../lib/queries';
import { useDashboard, rangeToDays, getMuscleColor } from './DashboardContext';

function isoWeekLabel(dateStr) {
    const d = new Date(dateStr);
    // Get Monday of the week
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // adjust to Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${dd}/${mm}`;
}

export default function WeeklyVolumeChart() {
    const { t } = useTranslation();
    const { dateRange, volumeMetric, selectedMuscle } = useDashboard();
    const days = rangeToDays(dateRange);

    const { data = { by_muscle: [], by_day: [] }, isLoading } = useQuery({
        queryKey: queryKeys.volumeByMuscle(days),
        queryFn: () => fetchVolumeByMuscle(days),
        staleTime: 2 * 60 * 1000,
    });

    // Group by_day into ISO weeks → muscle
    const weekMap = {};
    const muscleSet = new Set();

    for (const row of data.by_day) {
        const weekLabel = isoWeekLabel(row.date);
        muscleSet.add(row.muscle_group);
        if (!weekMap[weekLabel]) weekMap[weekLabel] = {};
        const val = volumeMetric === 'tonnage' ? row.tonnage
            : volumeMetric === 'sets' ? row.sets
            : row.reps;
        weekMap[weekLabel][row.muscle_group] = (weekMap[weekLabel][row.muscle_group] || 0) + val;
    }

    const weeks = Object.keys(weekMap);
    const muscles = Array.from(muscleSet);

    const traces = muscles.map(mg => ({
        x: weeks,
        y: weeks.map(w => Math.round((weekMap[w][mg] || 0) * 10) / 10),
        type: 'bar',
        name: mg,
        marker: {
            color: getMuscleColor(mg),
            opacity: (!selectedMuscle || mg === selectedMuscle) ? 1 : 0.2,
        },
        hovertemplate: `<b>${mg}</b><br>%{y:.0f}<extra></extra>`,
    }));

    const yLabel = volumeMetric === 'tonnage' ? t('dashboard.toggle.tonnage')
        : volumeMetric === 'sets' ? t('dashboard.toggle.sets')
        : t('dashboard.toggle.reps');

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.weeklyVolume')}</h3>
                {selectedMuscle && (
                    <span className="ml-1 text-xs text-green-400 font-medium">— {selectedMuscle}</span>
                )}
            </div>
            <div className="min-h-[220px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                    </div>
                ) : weeks.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                        {t('dashboard.noData')}
                    </div>
                ) : (
                    <Plot
                        data={traces}
                        layout={{
                            barmode: 'stack',
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#9ca3af', family: 'sans-serif', size: 11 },
                            xaxis: {
                                gridcolor: '#1f2937',
                                linecolor: '#374151',
                                tickcolor: '#374151',
                                automargin: true,
                                tickangle: -30,
                            },
                            yaxis: {
                                gridcolor: '#1f2937',
                                linecolor: '#374151',
                                tickcolor: '#374151',
                                title: { text: yLabel, font: { color: '#6b7280', size: 11 } },
                                automargin: true,
                            },
                            margin: { t: 10, r: 10, b: 50, l: 55 },
                            legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: '#9ca3af', size: 10 }, orientation: 'h', y: -0.35 },
                            hovermode: 'x unified',
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
