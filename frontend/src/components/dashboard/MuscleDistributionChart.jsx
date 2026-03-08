import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PieChart } from 'lucide-react';
import { queryKeys, fetchVolumeByMuscle } from '../../lib/queries';
import { useDashboard, rangeToDays, getMuscleColor } from './DashboardContext';

export default function MuscleDistributionChart() {
    const { t } = useTranslation();
    const { dateRange, volumeMetric, setVolumeMetric, selectedMuscle, setSelectedMuscle } = useDashboard();
    const days = rangeToDays(dateRange);

    const { data = { by_muscle: [], by_day: [] }, isLoading } = useQuery({
        queryKey: queryKeys.volumeByMuscle(days),
        queryFn: () => fetchVolumeByMuscle(days),
        staleTime: 2 * 60 * 1000,
    });

    const rows = data.by_muscle;

    const labels = rows.map(r => r.muscle_group);
    const values = rows.map(r =>
        volumeMetric === 'tonnage' ? r.tonnage
        : volumeMetric === 'sets' ? r.sets
        : r.reps
    );
    const colors = labels.map(getMuscleColor);

    const toggle = [
        { key: 'tonnage', label: t('dashboard.toggle.tonnage') },
        { key: 'sets', label: t('dashboard.toggle.sets') },
        { key: 'reps', label: t('dashboard.toggle.reps') },
    ];

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.muscleDistribution')}</h3>
                </div>
                <div className="flex bg-gray-950 p-0.5 rounded-lg border border-gray-800 gap-0.5">
                    {toggle.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setVolumeMetric(key)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                volumeMetric === key ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'
                            }`}
                        >
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
                ) : rows.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                        {t('dashboard.noData')}
                    </div>
                ) : (
                    <Plot
                        data={[{
                            type: 'pie',
                            labels,
                            values,
                            hole: 0.45,
                            marker: {
                                colors,
                                line: { color: '#111827', width: 2 },
                            },
                            textinfo: 'percent',
                            textfont: { color: '#fff', size: 11 },
                            hovertemplate: '<b>%{label}</b><br>%{value:.0f}<br>%{percent}<extra></extra>',
                            pull: labels.map(l => selectedMuscle && l !== selectedMuscle ? 0 : 0.05),
                        }]}
                        layout={{
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            margin: { t: 5, r: 5, b: 5, l: 5 },
                            showlegend: true,
                            legend: {
                                font: { color: '#9ca3af', size: 10 },
                                bgcolor: 'rgba(0,0,0,0)',
                                orientation: 'v',
                                x: 1.02, y: 0.5,
                                xanchor: 'left',
                            },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: '220px' }}
                        useResizeHandler
                        onClick={(e) => {
                            if (e.points && e.points[0]) {
                                const clicked = e.points[0].label;
                                setSelectedMuscle(prev => prev === clicked ? null : clicked);
                            }
                        }}
                    />
                )}
            </div>
            {selectedMuscle && (
                <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-gray-300">
                        Filtering: <span className="font-semibold text-white">{selectedMuscle}</span>
                    </span>
                    <button
                        onClick={() => setSelectedMuscle(null)}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        ✕ Clear
                    </button>
                </div>
            )}
        </div>
    );
}
