import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, LogIn } from 'lucide-react';
import api from '../api/axios';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [dbDebug, setDbDebug] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('debug-db/').then(res => setDbDebug(res.data)).catch(err => setDbDebug({ status: 'error', detail: String(err) }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const response = await api.post('token/', { username, password });
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            navigate('/workout');
        } catch (err) {
            console.error('Login failed', err);
            setError('Invalid username or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-gray-900 p-10 rounded-3xl border border-gray-800 shadow-2xl">
                <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/20">
                        <Dumbbell className="h-8 w-8 text-blue-500" />
                    </div>
                    <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        Sign in to log your next workout
                    </p>
                </div>

                {dbDebug && (
                    <div className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg p-3 font-mono">
                        <p className={dbDebug.status === 'connected' ? 'text-green-400' : 'text-red-400'}>
                            DB: {dbDebug.status}
                        </p>
                        {dbDebug.users && dbDebug.users.map(u => (
                            <p key={u.username}>user: {u.username} | active: {String(u.is_active)} | superuser: {String(u.is_superuser)}</p>
                        ))}
                        {dbDebug.detail && <pre className="text-red-400 whitespace-pre-wrap break-all mt-1">{dbDebug.detail.slice(0, 600)}</pre>}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg p-3 text-center">
                            {error}
                        </div>
                    )}
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
                            <input
                                type="text"
                                required
                                className="appearance-none block w-full px-4 py-3 border border-gray-700 bg-gray-950 placeholder-gray-500 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                className="appearance-none block w-full px-4 py-3 border border-gray-700 bg-gray-950 placeholder-gray-500 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                    >
                        {isLoading ? 'Signing in...' : (
                            <>
                                Sign in <LogIn className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
