import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Shield, Smartphone, AlertCircle, RefreshCw, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuthStore } from '../store';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setShow2FA(true);
        setLoading(false);
        return;
      }

      // Success
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      navigate('/');
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (twoFAToken.length !== 6) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFAToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid 2FA code');
        setLoading(false);
        return;
      }

      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      navigate('/');
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a] overflow-hidden relative px-4 py-8">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#f27d26]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#f27d26]/5 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {!show2FA ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 md:p-12 rounded-2xl w-full max-w-md text-center relative z-10"
          >
            {/* Logo */}
            <div className="w-16 h-16 bg-[#f27d26]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="text-[#f27d26]" size={32} />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter mb-2 text-[#f27d26]">IST MARKETS</h1>
            <p className="text-white/60 mb-8 uppercase tracking-widest text-xs">News Automation Platform</p>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              {/* Username */}
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest mb-1 block">Username or Email</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username or email"
                    autoComplete="username"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#f27d26] transition-colors"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs text-white/50 uppercase tracking-widest mb-1 block">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#f27d26] transition-colors"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/5 p-3 rounded-lg border border-red-400/10">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="w-full flex items-center justify-center gap-2 bg-[#f27d26] text-black font-bold py-4 rounded-xl hover:bg-[#f27d26]/90 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>

            <div className="mt-10 pt-6 border-t border-white/10">
              <p className="text-[10px] text-white/20 uppercase tracking-widest">
                Authorized Personnel Only
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="2fa"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass p-6 md:p-12 rounded-2xl w-full max-w-md text-center relative z-10 space-y-8"
          >
            <div className="w-16 h-16 bg-blue-400/10 rounded-full flex items-center justify-center mx-auto text-blue-400">
              <Smartphone size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Two-Factor Auth</h3>
              <p className="text-sm text-white/40">Enter the 6-digit code from your authenticator app</p>
            </div>

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={twoFAToken}
                onChange={e => setTwoFAToken(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-center text-xl md:text-3xl font-mono tracking-[0.3em] md:tracking-[0.5em] focus:outline-none focus:border-[#f27d26] transition-colors"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs justify-center">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || twoFAToken.length !== 6}
                className="w-full py-4 bg-[#f27d26] text-black font-bold rounded-xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw size={18} className="animate-spin mx-auto" /> : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setShow2FA(false); setTwoFAToken(''); setError(''); }}
                className="text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                Back to Login
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
