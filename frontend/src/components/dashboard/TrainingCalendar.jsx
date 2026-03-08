import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarDays, X } from 'lucide-react';
import { queryKeys, fetchTrainingCalendar, fetchHistory } from '../../lib/queries';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return (d.getDay() + 6) % 7; // 0=Mon ... 6=Sun
}

function getMondayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d.toISOString().slice(0, 10);
}

export default function TrainingCalendar() {
    const { t } = useTranslation();
    const [selectedDay, setSelectedDay] = useState(null);

    const { data: calendarData = [], isLoading } = useQuery({
        queryKey: queryKeys.trainingCalendar(),
        queryFn: fetchTrainingCalendar,
        staleTime: 5 * 60 * 1000,
    });

    const { data: history = [] } = useQuery({
        queryKey: queryKeys.history(),
        queryFn: fetchHistory,
        staleTime: 2 * 60 * 1000,
    });

    // Build lookup: date → cal entry
    const calMap = {};
    for (const e of calendarData) calMap[e.date] = e;

    // Build date range: last 16 weeks (Mon–Sun grid)
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    // Find the Monday of the current week
    const dow = (today.getDay() + 6) % 7;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - dow);

    const NUM_WEEKS = 16;
    const startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - (NUM_WEEKS - 1) * 7);

    // Generate all days in range
    const weeks = [];
    let cursor = new Date(startMonday);
    for (let w = 0; w < NUM_WEEKS; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            const dateStr = cursor.toISOString().slice(0, 10);
            week.push(dateStr);
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    // Build z matrix: rows = days of week, cols = weeks
    const z = Array.from({ length: 7 }, () => Array(NUM_WEEKS).fill(null));
    const textMatrix = Array.from({ length: 7 }, () => Array(NUM_WEEKS).fill(''));
    const xLabels = weeks.map(w => w[0].slice(5)); // MM-DD of Monday

    for (let w = 0; w < NUM_WEEKS; w++) {
        for (let d = 0; d < 7; d++) {
            const dateStr = weeks[w][d];
            const entry = calMap[dateStr];
            const isFuture = dateStr > todayStr;
            if (isFuture) {
                z[d][w] = -1; // future - special color
            } else {
                z[d][w] = entry ? Math.min(entry.session_count, 3) : 0;
            }
            textMatrix[d][w] = entry ? `${dateStr}<br>${entry.session_count} session(s)<br>${Math.round(entry.tonnage)} kg tonnage` : dateStr;
        }
    }

    const colorscale = [
        [0, '#111827'],     // -1 future (won't be visible, but needs a lower bound handled differently)
        [0.05, '#111827'],  // 0 = no session
        [0.4, '#166534'],   // 1 session
        [0.7, '#16a34a'],   // 2 sessions
        [1.0, '#4ade80'],   // 3+ sessions
    ];

    // Find session detail for selected day
    const selectedSession = selectedDay
        ? history.find(s => s.date === selectedDay)
        : null;
    const calEntry = selectedDay ? calMap[selectedDay] : null;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-semibold text-white">{t('dashboard.charts.trainingCalendar')}</h3>
            </div>

            <div className="min-h-[180px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
                    </div>
                ) : (
                    <Plot
                        data={[{
                            type: 'heatmap',
                            z,
                            x: xLabels,
                            y: DAY_LABELS,
                            text: textMatrix,
                            hoverinfo: 'text',
                            colorscale,
                            showscale: false,
                            zmin: 0,
                            zmax: 3,
                            xgap: 3,
                            ygap: 3,
                        }]}
                        layout={{
                            paper_bgcolor: 'rgba(0,0,0,0)',
                            plot_bgcolor: 'rgba(0,0,0,0)',
                            font: { color: '#6b7280', family: 'sans-serif', size: 10 },
                            xaxis: { showgrid: false, zeroline: false, tickangle: -45, automargin: true, tickcolor: 'transparent', linecolor: 'transparent' },
                            yaxis: { showgrid: false, zeroline: false, automargin: true, tickcolor: 'transparent', linecolor: 'transparent' },
                            margin: { t: 5, r: 5, b: 50, l: 45 },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: '180px' }}
                        useResizeHandler
                        onClick={(e) => {
                            if (e.points && e.points[0]) {
                                const colIdx = e.points[0].x; // MM-DD label
                                const rowIdx = e.points[0].y; // day label
                                const wIdx = xLabels.indexOf(colIdx);
                                const dIdx = DAY_LABELS.indexOf(rowIdx);
                                if (wIdx >= 0 && dIdx >= 0) {
                                    const clickedDate = weeks[wIdx][dIdx];
                                    setSelectedDay(prev => prev === clickedDate ? null : clickedDate);
                                }
                            }
                        }}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Less</span>
                {['#111827', '#166534', '#16a34a', '#4ade80'].map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ background: c, border: '1px solid #374151' }} />
                ))}
                <span className="text-xs text-gray-500">More</span>
            </div>

            {/* Session detail popover */}
            {selectedDay && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-semibold text-white">{selectedDay}</p>
                            {calEntry && (
                                <p className="text-xs text-gray-400">
                                    {calEntry.session_count} session(s) · {Math.round(calEntry.tonnage)} kg tonnage
                                    {calEntry.plan_day_labels?.length > 0 && ` · Day ${calEntry.plan_day_labels.join('/')}`}
                                </p>
                            )}
                            {!calEntry && <p className="text-xs text-gray-500">No session logged</p>}
                        </div>
                        <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    {selectedSession && (
                        <div className="space-y-1.5">
                            {selectedSession.exercises.map(ex => (
                                <div key={ex.id} className="text-xs">
                                    <span className="text-gray-300 font-medium">{ex.exercise.name}</span>
                                    <span className="text-gray-500 ml-1.5">
                                        {ex.sets.length} sets ·{' '}
                                        best {Math.max(...ex.sets.map(s => s.weight))} × {ex.sets.find(s => s.weight === Math.max(...ex.sets.map(s => s.weight)))?.reps}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
