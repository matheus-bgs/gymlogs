import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Scale, Dumbbell, Flame, Timer, Zap, Trophy } from 'lucide-react';
import { queryKeys, fetchDashboardSummary } from '../../lib/queries';
import { useDashboard, rangeToDays } from './DashboardContext';

function DeltaBadge({ delta, invertGood = false, decimals = 1 }) {
    if (delta === null || delta === undefined || isNaN(delta)) return null;
    const isNeutral = Math.abs(delta) < 0.01;
    const isGood = isNeutral ? true : (invertGood ? delta <= 0 : delta >= 0);
    const color = isNeutral ? 'text-gray-400' : isGood ? 'text-green-400' : 'text-red-400';
    const Icon = isNeutral ? Minus : isGood ? TrendingUp : TrendingDown;
    const sign = delta > 0 ? '+' : '';
    const formatted = `${sign}${Number(delta).toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
    return (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
            <Icon className="w-3 h-3" />
            {formatted}
        </span>
    );
}

function KpiCard({ icon: Icon, label, value, unit, delta, deltaDecimals = 1, subtitle, invertGood = false, isLoading }) {
    if (isLoading) {
        return (
            <div className="flex-1 min-w-[140px] bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-pulse">
                <div className="h-4 w-20 bg-gray-800 rounded mb-3" />
                <div className="h-7 w-24 bg-gray-800 rounded mb-2" />
                <div className="h-3 w-16 bg-gray-800 rounded" />
            </div>
        );
    }
    return (
        <div className="flex-1 min-w-[140px] bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 bg-green-600/10 rounded-lg flex items-center justify-center border border-green-500/20">
                    <Icon className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
            </div>
            <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-white leading-none">
                    {value ?? '—'}
                </span>
                {unit && <span className="text-sm text-gray-400 mb-0.5">{unit}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
                {delta !== null && delta !== undefined && (
                    <DeltaBadge delta={delta} invertGood={invertGood} decimals={deltaDecimals} />
                )}
                {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
            </div>
        </div>
    );
}

export default function KpiStrip() {
    const { t } = useTranslation();
    const { dateRange } = useDashboard();
    const days = rangeToDays(dateRange);

    const { data: summary = {}, isLoading } = useQuery({
        queryKey: queryKeys.dashboardSummary(days),
        queryFn: () => fetchDashboardSummary(days),
        staleTime: 2 * 60 * 1000,
    });

    const sessionDelta = summary.sessions_prior != null
        ? summary.sessions_current - summary.sessions_prior
        : null;
    const tonDelta = summary.tonnage_prior != null && summary.tonnage_current != null
        ? summary.tonnage_current - summary.tonnage_prior
        : null;

    const fmt = (n, decimals = 1) =>
        n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals }) : null;

    return (
        <div className="flex gap-3 overflow-x-auto pb-1">
            <KpiCard
                icon={Scale}
                label={t('dashboard.kpi.weight')}
                value={fmt(summary.current_weight)}
                unit={summary.weight_unit}
                delta={summary.weight_delta}
                subtitle={t('dashboard.vsLastPeriod')}
                invertGood={true}
                isLoading={isLoading}
            />
            <KpiCard
                icon={Dumbbell}
                label={t('dashboard.kpi.sessions')}
                value={summary.sessions_current}
                delta={sessionDelta}
                deltaDecimals={0}
                subtitle={t('dashboard.vsLastPeriod')}
                isLoading={isLoading}
            />
            <KpiCard
                icon={Flame}
                label={t('dashboard.kpi.tonnage')}
                value={fmt(summary.tonnage_current, 0)}
                unit={summary.weight_unit}
                delta={tonDelta}
                deltaDecimals={0}
                subtitle={t('dashboard.vsLastPeriod')}
                isLoading={isLoading}
            />
            <KpiCard
                icon={Timer}
                label={t('dashboard.kpi.avgDuration')}
                value={fmt(summary.avg_duration_minutes, 0)}
                unit={t('dashboard.kpi.min')}
                delta={summary.avg_duration_delta}
                subtitle={t('dashboard.vsLastPeriod')}
                isLoading={isLoading}
            />
            <KpiCard
                icon={Zap}
                label={t('dashboard.kpi.streak')}
                value={summary.streak_weeks}
                unit={t('dashboard.kpi.weeks')}
                subtitle={t('dashboard.kpi.streak_desc')}
                isLoading={isLoading}
            />
            <KpiCard
                icon={Trophy}
                label={t('dashboard.kpi.prs')}
                value={summary.pr_count_30d}
                subtitle={t('dashboard.kpi.last30d')}
                isLoading={isLoading}
            />
        </div>
    );
}
