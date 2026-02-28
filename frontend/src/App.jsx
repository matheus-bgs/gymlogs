import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { Dumbbell, LineChart, LogOut, ClipboardList, Menu, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Register from './pages/Register';
import Workout from './pages/Workout';
import Graph from './pages/Graph';
import Plan from './pages/Plan';
import HistoryPage from './pages/History';

function PrivateRoute({ children }) {
    const token = localStorage.getItem('access_token');
    return token ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            localStorage.setItem('sidebarCollapsed', String(!prev));
            return !prev;
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
    };

    const toggleLanguage = () => {
        const next = i18n.language === 'en' ? 'pt' : 'en';
        i18n.changeLanguage(next);
        localStorage.setItem('language', next);
    };

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
            ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`;

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 z-50 flex flex-col transition-all duration-200
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${collapsed ? 'md:w-16' : 'md:w-64'} w-64`}>
                {/* Logo + collapse toggle */}
                <div className="flex items-center border-b border-gray-800 h-16 flex-shrink-0 overflow-hidden">
                    <div className={`flex items-center gap-2.5 flex-1 min-w-0 transition-all duration-200 ${collapsed ? 'px-0 justify-center' : 'px-5'}`}>
                        <img src="/gymlogs_logo.png" alt="Gymlogs" className="h-9 w-9 object-contain flex-shrink-0" />
                        {!collapsed && <span className="text-green-500 font-bold text-xl tracking-tight whitespace-nowrap">Gymlogs</span>}
                    </div>
                    <button
                        onClick={toggleCollapsed}
                        className="hidden md:flex items-center justify-center w-8 h-8 mr-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                    {[{ to: '/workout', icon: <Dumbbell className="h-4 w-4 flex-shrink-0" />, label: t('nav.logWorkout') },
                    { to: '/plan', icon: <ClipboardList className="h-4 w-4 flex-shrink-0" />, label: t('nav.plan') },
                    { to: '/graph', icon: <LineChart className="h-4 w-4 flex-shrink-0" />, label: t('nav.progress') },
                    { to: '/history', icon: <Clock className="h-4 w-4 flex-shrink-0" />, label: t('nav.history') },
                    ].map(({ to, icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={navLinkClass}
                            onClick={() => setSidebarOpen(false)}
                            title={collapsed ? label : undefined}
                        >
                            {icon}
                            {!collapsed && <span className="truncate">{label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Language + Logout */}
                <div className="px-2 py-4 border-t border-gray-800 space-y-1">
                    <button
                        onClick={toggleLanguage}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title={collapsed ? (i18n.language === 'en' ? 'Switch to PT' : 'Switch to EN') : 'Switch language'}
                    >
                        <span className="flex-shrink-0">{i18n.language === 'en' ? '🇧🇷' : '🇺🇸'}</span>
                        {!collapsed && <span>{i18n.language === 'en' ? 'PT' : 'EN'}</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title={collapsed ? t('nav.logout') : undefined}
                    >
                        <LogOut className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && t('nav.logout')}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
                {/* Mobile top bar */}
                <header className="md:hidden bg-gray-900 border-b border-gray-800 sticky top-0 z-30 flex items-center gap-3 h-14 px-4">
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2 text-green-500 font-bold">
                        <img src="/gymlogs_logo.png" alt="Gymlogs" className="h-7 w-7 object-contain" />
                        Gymlogs
                    </div>
                </header>
                <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/workout" element={
                    <PrivateRoute>
                        <Layout>
                            <Workout />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/graph" element={
                    <PrivateRoute>
                        <Layout>
                            <Graph />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/plan" element={
                    <PrivateRoute>
                        <Layout>
                            <Plan />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="/history" element={
                    <PrivateRoute>
                        <Layout>
                            <HistoryPage />
                        </Layout>
                    </PrivateRoute>
                } />
                <Route path="*" element={<Navigate to="/workout" />} />
            </Routes>
        </Router>
    );
}

export default App;
