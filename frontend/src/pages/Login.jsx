import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import queryClient from '../lib/queryClient';
import { queryKeys, fetchExercises } from '../lib/queries';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const response = await api.post('token/', { username, password });
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            // Clear any cached data from a previous user session before warming the cache
            queryClient.clear();
            // Warm the cache before navigating so the Workout page loads instantly
            await queryClient.prefetchQuery({
                queryKey: queryKeys.exercises(),
                queryFn: fetchExercises,
            });
            navigate('/workout');
        } catch (err) {
            console.error('Login failed', err);
            setError(t('login.invalidCredentials'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-gray-900 p-10 rounded-3xl border border-gray-800 shadow-2xl">
                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center mb-4">
                        <img src="/gymlogs_logo.png" alt="Gymlogs" className="h-24 w-auto object-contain" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
                        {t('login.welcomeBack')}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        {t('login.subtitle')}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg p-3 text-center">
                            {error}
                        </div>
                    )}
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('login.username')}</label>
                            <input
                                type="text"
                                required
                                className="appearance-none block w-full px-4 py-3 border border-gray-700 bg-gray-950 placeholder-gray-500 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder={t('login.usernamePlaceholder')}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('login.password')}</label>
                            <input
                                type="password"
                                required
                                className="appearance-none block w-full px-4 py-3 border border-gray-700 bg-gray-950 placeholder-gray-500 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
                    >
                        {isLoading ? t('login.signingIn') : (
                            <>
                                {t('login.signIn')} <LogIn className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    <p className="text-center text-sm text-gray-400">
                        {t('login.noAccount')}{' '}
                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="text-green-400 hover:text-green-300 font-medium transition-colors inline-flex items-center gap-1"
                        >
                            {t('login.register')} <UserPlus className="w-3.5 h-3.5" />
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default Login;

