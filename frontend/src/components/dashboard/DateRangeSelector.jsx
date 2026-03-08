import { useTranslation } from 'react-i18next';
import { RANGE_OPTIONS, useDashboard } from './DashboardContext';

export default function DateRangeSelector() {
    const { t } = useTranslation();
    const { dateRange, setDateRange } = useDashboard();

    return (
        <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 gap-0.5">
            {RANGE_OPTIONS.map((r) => (
                <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        dateRange === r
                            ? 'bg-green-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    {t(`dashboard.dateRange.${r}`)}
                </button>
            ))}
        </div>
    );
}
