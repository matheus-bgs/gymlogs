import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Dumbbell, LineChart, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Login from './pages/Login';
import Register from './pages/Register';
import Workout from './pages/Workout';
import Graph from './pages/Graph';

function PrivateRoute({ children }) {
    const token = localStorage.getItem('access_token');
    return token ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

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

    return (
        <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
            <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-8">
                            <div className="flex-shrink-0 flex items-center gap-2 text-green-500 font-bold text-xl tracking-tight">
                                <img src="/gymlogs_logo.png" alt="Gymlogs" className="h-10 w-10 object-contain" />
                                Gymlogs
                            </div>
                            <div className="hidden md:flex gap-2">
                                <Link to="/workout" className="text-gray-300 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                                    <Dumbbell className="h-4 w-4" /> {t('nav.logWorkout')}
                                </Link>
                                <Link to="/graph" className="text-gray-300 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                                    <LineChart className="h-4 w-4" /> {t('nav.progress')}
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleLanguage}
                                className="text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                title="Switch language"
                            >
                                {i18n.language === 'en' ? '🇧🇷 PT' : '🇺🇸 EN'}
                            </button>
                            <button onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t('nav.logout')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
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
                <Route path="*" element={<Navigate to="/workout" />} />
            </Routes>
        </Router>
    );
}

export default App;
