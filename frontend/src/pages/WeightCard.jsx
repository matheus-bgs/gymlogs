import React, { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, fetchWeight, saveWeight } from '../lib/queries';

const KG_TO_LBS = 2.20462;

const toDisplay = (kg, unit) =>
    unit === 'lbs' ? Math.round(kg * KG_TO_LBS * 10) / 10 : kg;

const toKg = (value, unit) =>
    unit === 'lbs' ? Math.round((value / KG_TO_LBS) * 100) / 100 : value;

const dayLabel = (dateStr, t) => {
    // Parse dateStr (YYYY-MM-DD) as local midnight to avoid UTC offset shifting the date
    const [y, m, d] = dateStr.split('-').map(Number);
    const entryMidnight = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
    const diff = Math.round(
        (new Date().setHours(0, 0, 0, 0) - entryMidnight) /
        86400000
    );
    if (diff === 1) return t('weight.yesterday');
    return t('weight.daysAgo', { count: diff });
};

export default function WeightCard({ weightUnit = 'kg' }) {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const _d = new Date();
    const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

    const { data, isLoading } = useQuery({
        queryKey: queryKeys.weight(),
        queryFn: fetchWeight,
    });

    const [inputValue, setInputValue] = useState('');
    const [saved, setSaved] = useState(false);

    // Pre-fill when today's entry loads (or when weight unit changes)
    useEffect(() => {
        if (data?.today?.weight != null) {
            setInputValue(String(toDisplay(data.today.weight, weightUnit)));
        }
    }, [data?.today?.weight, weightUnit]);

    const mutation = useMutation({
        mutationFn: saveWeight,
        onSuccess: () => {
            qc.invalidateQueries(queryKeys.weight());
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        },
    });

    const handleSave = () => {
        const num = parseFloat(String(inputValue).replace(',', '.'));
        if (!num || num <= 0) return;
        mutation.mutate({ weight: toKg(num, weightUnit), date: today });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
    };

    const lastEntry = data?.last;
    const unit = weightUnit === 'lbs' ? 'lbs' : 'kg';

    return (
        <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-xl px-6 py-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                    <Scale className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-gray-200 tracking-wide">
                    {t('weight.todaysWeight')}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    inputMode="decimal"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.replace(/[^\d,.]*/g, ''))}
                    onKeyDown={handleKeyDown}
                    placeholder="—"
                    className="w-28 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center"
                    disabled={isLoading}
                />
                <span className="text-gray-400 text-sm font-medium">{unit}</span>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={mutation.isPending || !inputValue}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                    {mutation.isPending
                        ? '…'
                        : saved
                        ? t('weight.saved')
                        : t('weight.save')}
                </button>
            </div>

            {lastEntry && (
                <p className="mt-2 text-xs text-gray-500">
                    {t('weight.last')}:{' '}
                    <span className="text-gray-400 font-medium">
                        {toDisplay(lastEntry.weight, weightUnit)} {unit}
                    </span>{' '}
                    <span>({dayLabel(lastEntry.date, t)})</span>
                </p>
            )}
        </div>
    );
}
