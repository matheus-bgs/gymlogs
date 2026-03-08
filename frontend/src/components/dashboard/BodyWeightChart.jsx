import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { queryKeys, fetchWeightHistory, fetchProfile } from '../../lib/queries';
import { useDashboard, rangeToDays } from './DashboardContext';

const DARK_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#9ca3af', family: 'sans-serif', size: 11 },
    xaxis: {
        gridcolor: '#1f2937',
        linecolor: '#374151',
        tickcolor: '#374151',
        automargin: true,
    },
    yaxis: {
        gridcolor: '#1f2937',
        linecolor: '#374151',
        tickcolor: '#374151',
        automargin: true,
    },
    margin: { t: 10, r: 10, b: 40, l: 50 },
    legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: '#9ca3af', size: 11 } },
};

function rollingAvg(values, window = 7) {
    return values.map((_, i) => {
        const slice = values.slice(Math.max(0, i - window + 1), i + 1);
        return slice.reduce((s, v) => s + v, 0) / slice.length;
    });
}

export default function BodyWeightChart() {
    const { t } = useTranslation();
    const { dateRange } = useDashboard();
    const days = rangeToDays(dateRange);

    const { data: profile = { weight_unit: 'kg' } } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: fetchProfile,
        staleTime: 5 * 60 * 1000,
    });
    const { data: history = [], isLoading } = useQuery({
        queryKey: queryKeys.weightHistory(),
        queryFn: fetchWeightHistory,
        staleTime: 5 * 60 * 1000,
    });

    const convert = (v) => profile.weight_unit === 'lbs' ? v * 2.20462 : v;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = history.filter(e => new Date(e.date) >= cutoff);
    const dates = filtered.map(e => e.date);
    const weights = filtered.map(e => parseFloat(convert(e.weight).toFixed(2)));
    const rolling = rollingAvg(weights, 7);
    const showRolling = days >= 30 && weights.length >= 3;

    const traces = [];
    if (dates.length) {
        traces.push({
            x: dates,
            y: weights,
            type: 'scatter',
            mode: 'lines+markers',
            name: profile.weight_unit,
            marker: { color: '#6CB33E', size: 6 },
            line: { color: '#6CB33E', width: 2, shape: 'spline', smoothing: 1.2 },
            fill: 'tozeroy',
            fillcolor: 'rgba(108,179,62,0.07)',
        });
        if (showRolling) {
            traces.push({
                x: dates,
                y: rolling.map(v => parseFloat(v.toFixed(2))),
                type: 'scatter',
                mode: 'lines',
                name: t('dashboard.charts.movingAvg'),
                line: { color: 'rgba(255,255,255,0.4)', width: 2.5, dash: 'dot' },
                hovertemplate: '%{y:.1f} ' + profile.weight_unit + '<extra>7d avg</extra>',
            });
        }
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.bodyWeight')}</h3>
            </div>
            <div className="min-h-[220px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                    </div>
                ) : dates.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                        {t('dashboard.noData')}
                    </div>
                ) : (
                    <Plot
                        data={traces}
                        layout={{
                            ...DARK_LAYOUT,
                            yaxis: {
                                ...DARK_LAYOUT.yaxis,
                                title: { text: profile.weight_unit, font: { color: '#6b7280', size: 11 } },
                            },
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
