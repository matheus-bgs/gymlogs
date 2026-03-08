import { createContext, useContext, useState } from 'react';

const DashboardContext = createContext(null);

export const RANGE_OPTIONS = ['7d', '30d', '90d', '1y', 'all'];

export const rangeToDays = (range) => {
    switch (range) {
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        case '1y': return 365;
        case 'all': return 3650; // ~10 years
        default: return 30;
    }
};

export const MUSCLE_COLORS = {
    'Chest': '#ef4444',
    'Back': '#3b82f6',
    'Shoulders': '#f59e0b',
    'Biceps': '#8b5cf6',
    'Triceps': '#ec4899',
    'Legs': '#10b981',
    'Quadriceps': '#10b981',
    'Hamstrings': '#059669',
    'Glutes': '#14b8a6',
    'Core': '#f97316',
    'Abs': '#6366f1',
    'Calves': '#84cc16',
    'Forearms': '#22d3ee',
    'Other': '#6b7280',
};

export const getMuscleColor = (muscle) =>
    MUSCLE_COLORS[muscle] ?? '#6b7280';

export const PLAN_DAY_COLORS = {
    A: '#3b82f6',
    B: '#f59e0b',
    C: '#8b5cf6',
    D: '#10b981',
    E: '#ef4444',
};

export const getPlanDayColor = (label) =>
    PLAN_DAY_COLORS[label] ?? '#6b7280';

export function DashboardProvider({ children }) {
    const [dateRange, setDateRange] = useState('30d');
    const [volumeMetric, setVolumeMetric] = useState('tonnage'); // 'tonnage' | 'sets' | 'reps'
    const [selectedMuscle, setSelectedMuscle] = useState(null);

    return (
        <DashboardContext.Provider value={{
            dateRange, setDateRange,
            volumeMetric, setVolumeMetric,
            selectedMuscle, setSelectedMuscle,
        }}>
            {children}
        </DashboardContext.Provider>
    );
}

export const useDashboard = () => {
    const ctx = useContext(DashboardContext);
    if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
    return ctx;
};
