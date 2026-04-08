import { useState } from 'react';
import { loginWithGoogle, db, auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithAuth } from '../lib/api';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Shield, Smartphone, AlertCircle, RefreshCw } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [show2FA, setShow2FA] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const logActivity = async (status: 'success' | 'failure', user: any) => {
    try {
      await fetchWithAuth('/api/auth/login-activity', {
        method: 'POST',
        body: JSON.stringify({
          status,
          ip: 'unknown', // Server-side would be better for real IP
          userAgent: navigator.userAgent
        })
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await loginWithGoogle();
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'viewer',
            createdAt: serverTimestamp(),
          });
          await logActivity('success', user);
          navigate('/');
        } else {
          const userData = userSnap.data();
          if (userData.two_factor_enabled) {
            setShow2FA(true);
            setLoading(false);
          } else {
            await updateDoc(userRef, { last_login: new Date().toISOString() });
            await logActivity('success', user);
            navigate('/');
          }
        }
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setError(error.message || "Login failed");
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user found");

      const response = await fetchWithAuth('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        await updateDoc(doc(db, 'users', user.uid), { last_login: new Date().toISOString() });
        await logActivity('success', user);
        navigate('/');
      } else {
        const data = await response.json();
        setError(data.error || "Invalid 2FA code");
        await logActivity('failure', user);
      }
    } catch (error: any) {
      setError(error.message || "Verification failed");
    } finally {
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
            <h1 className="text-4xl font-bold tracking-tighter mb-2 text-[#f27d26]">IST MARKETS</h1>
            <p className="text-white/60 mb-8 uppercase tracking-widest text-xs">News Automation Platform</p>
            
            <div className="space-y-6">
              <p className="text-sm text-white/40">
                Sign in to access the news fetching engine, AI rewriting tools, and Instagram publishing dashboard.
              </p>
              
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs justify-center bg-red-400/5 p-3 rounded-lg border border-red-400/10">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button 
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-4 rounded-lg hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" /> : (
                  <>
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    Continue with Google
                  </>
                )}
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-white/10">
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
              <p className="text-sm text-white/40">Enter the 6-digit code from your app</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-center text-xl md:text-3xl font-mono tracking-[0.3em] md:tracking-[0.5em] focus:outline-none focus:border-[#f27d26] transition-colors"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs justify-center">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <button 
                onClick={handleVerify2FA}
                disabled={loading || token.length !== 6}
                className="w-full py-4 bg-[#f27d26] text-black font-bold rounded-xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin mx-auto" /> : 'Verify & Sign In'}
              </button>
              <button 
                onClick={() => setShow2FA(false)}
                className="text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                Back to Login
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
