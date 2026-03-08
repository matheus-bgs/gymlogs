import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';
import { DashboardProvider } from '../components/dashboard/DashboardContext';
import DateRangeSelector from '../components/dashboard/DateRangeSelector';
import KpiStrip from '../components/dashboard/KpiStrip';
import BodyWeightChart from '../components/dashboard/BodyWeightChart';
import MuscleDistributionChart from '../components/dashboard/MuscleDistributionChart';
import WeeklyVolumeChart from '../components/dashboard/WeeklyVolumeChart';
import TrainingCalendar from '../components/dashboard/TrainingCalendar';
import StrengthProgressChart from '../components/dashboard/StrengthProgressChart';
import SessionDurationChart from '../components/dashboard/SessionDurationChart';
import PlanDayVolumeChart from '../components/dashboard/PlanDayVolumeChart';

function DashboardContent() {
    const { t } = useTranslation();

    return (
        <div className="max-w-7xl mx-auto font-sans space-y-6">
            {/* ── Page header ───────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20">
                        <LayoutDashboard className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">{t('dashboard.title')}</h2>
                        <p className="text-sm text-gray-400">{t('dashboard.subtitle')}</p>
                    </div>
                </div>
                <DateRangeSelector />
            </div>

            {/* ── Section 1: KPI strip ──────────────────────────────────────── */}
            <KpiStrip />

            {/* ── Section 2: Body weight + Muscle distribution ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                    <BodyWeightChart />
                </div>
                <div className="lg:col-span-2">
                    <MuscleDistributionChart />
                </div>
            </div>

            {/* ── Section 3: Weekly volume + Training calendar ──────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                    <WeeklyVolumeChart />
                </div>
                <div className="lg:col-span-2">
                    <TrainingCalendar />
                </div>
            </div>

            {/* ── Section 4: Strength progress (full width) ─────────────────── */}
            <StrengthProgressChart />

            {/* ── Section 5: Session duration + Plan day volume ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                    <SessionDurationChart />
                </div>
                <div className="lg:col-span-2">
                    <PlanDayVolumeChart />
                </div>
            </div>
        </div>
    );
}

export default function Graph() {
    return (
        <DashboardProvider>
            <DashboardContent />
        </DashboardProvider>
    );
}

