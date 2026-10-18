import React, { useState } from 'react';
import { X, ShieldCheck, AlertTriangle, Lock, User as UserIcon, Mail, ArrowRight } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface Props {
  onClose: () => void;
  onLogin: (user: User) => void;
}

type Mode = 'login' | 'signup';

export const LoginOverlay: React.FC<Props> = ({ onClose, onLogin }) => {
  const [mode, setMode] = useState<Mode>('login');

  const [username, setUsername] = useState('admin123');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
    if (next === 'signup') setUsername('');
    else setUsername('admin123');
  };

  /** Persist the session exactly as the old OTP/password paths did. */
  const finish = (user: User) => {
    localStorage.setItem('uniarchive_user', JSON.stringify(user));
    onLogin(user);
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      // POST /api/auth/login with { username, password }.
      const result = await api.login(username.trim(), password);
      const user: User = result?.user ?? {
        email: result?.user?.email ?? 'admin123@uniarchive.local',
        username: username.trim(),
        isVerified: true,
        role: result?.user?.role ?? 'admin'
      };
      finish(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[A-Za-z0-9._-]{3,30}$/.test(cleanUsername)) {
      setError('Username must be 3-30 characters (letters, numbers, . _ -)');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.signup(cleanUsername, cleanEmail, password);
      if (!result.user) throw new Error('Account created, but the server returned no user');
      finish(result.user);
    } catch (err: any) {
      setError(err.message || 'Could not create account');
    } finally {
      setIsLoading(false);
    }
  };

  const isSignup = mode === 'signup';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-uni-black/90 backdrop-blur-md p-4 font-mono">
      <div className="w-full max-w-md bg-uni-panel border border-uni-neon shadow-hard-neon relative overflow-hidden max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="p-5 sm:p-6 bg-uni-dark border-b border-uni-border flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-display font-bold text-uni-contrast uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck size={24} className="text-uni-neon shrink-0" />
            {isSignup ? 'Create Account' : 'Student Access'}
          </h2>
          <button onClick={onClose} className="text-uni-muted hover:text-uni-contrast transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="grid grid-cols-2 border-b border-uni-border">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-3 text-xs font-bold uppercase tracking-wide transition-colors ${!isSignup ? 'bg-uni-panel text-uni-neon' : 'bg-uni-dark text-uni-muted hover:text-uni-contrast'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`py-3 text-xs font-bold uppercase tracking-wide transition-colors ${isSignup ? 'bg-uni-panel text-uni-neon' : 'bg-uni-dark text-uni-muted hover:text-uni-contrast'}`}
          >
            Create account
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {!isSignup && (
            <div className="text-center mb-6">
              <p className="text-uni-muted text-xs uppercase">Demo account</p>
              <p className="text-uni-contrast text-sm font-bold">admin123 / scse</p>
            </div>
          )}

          {isSignup ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. arjun_23"
                    autoComplete="username"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@vitstudent.ac.in"
                    autoComplete="email"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-uni-alert text-xs">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-uni-neon text-uni-black font-display font-bold py-3 hover:bg-uni-contrast transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-hard-neon uppercase flex justify-center items-center gap-2"
              >
                {isLoading ? 'Creating account...' : 'Create account'} <ArrowRight size={16} />
              </button>

              <p className="prose-read text-center text-uni-muted text-[11px]">
                No email verification needed — your account works right away.
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin123"
                    autoComplete="username"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-uni-muted mb-2 uppercase">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-uni-muted" size={16} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="scse"
                    autoComplete="current-password"
                    className={`w-full bg-uni-black border ${error ? 'border-uni-alert' : 'border-uni-border'} p-3 pl-10 text-uni-contrast focus:border-uni-neon outline-none transition-colors`}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-uni-alert text-xs">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-uni-neon text-uni-black font-display font-bold py-3 hover:bg-uni-contrast transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-hard-neon uppercase flex justify-center items-center gap-2"
              >
                {isLoading ? 'Signing in...' : 'Sign in'} <ArrowRight size={16} />
              </button>
            </form>
          )}

          <p className="prose-read mt-5 text-center text-uni-muted text-[11px]">
            {isSignup ? 'Already have an account? Use the Sign in tab.' : 'New here? Use the Create account tab.'}
          </p>
        </div>

        {/* Footer decoration: flat accent blocks, no gradient */}
        <div className="h-1 w-full flex">
          <div className="h-full flex-1 bg-uni-neon"></div>
          <div className="h-full flex-1 bg-uni-cyan"></div>
          <div className="h-full flex-1 bg-uni-alert"></div>
        </div>
      </div>
    </div>
  );
};
