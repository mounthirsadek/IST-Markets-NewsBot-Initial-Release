import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, ShieldCheck, ShieldAlert, Lock, Smartphone, CheckCircle2, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';
import { fetchWithAuth } from '../lib/api';

export default function TwoFactorSetup() {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'success'>('initial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/api/auth/2fa/setup', {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setSecret(data.secret);
        setStep('setup');
      } else {
        setError(data.error || "Failed to start 2FA setup");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (response.ok) {
        setStep('success');
      } else {
        setError(data.error || "Invalid verification code");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tighter">Security Center</h2>
        <p className="text-white/40 uppercase tracking-widest text-xs mt-1">Two-Factor Authentication (2FA)</p>
      </header>

      <div className="glass p-8 rounded-2xl border-white/5 space-y-8">
        {step === 'initial' && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-[#f27d26]/10 rounded-full flex items-center justify-center mx-auto text-[#f27d26]">
              <Shield size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Enhance Your Security</h3>
              <p className="text-sm text-white/40 leading-relaxed max-w-md mx-auto">
                Add an extra layer of protection to your account. 2FA is mandatory for Admin and Super Admin roles.
              </p>
            </div>
            <button 
              onClick={startSetup}
              disabled={loading}
              className="px-8 py-3 bg-[#f27d26] text-black font-bold rounded-xl hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" /> : 'Setup 2FA Now'}
            </button>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div className="space-y-4">
                <h4 className="font-bold">Scan QR Code</h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code below.
                </p>
                <div className="bg-white p-4 rounded-xl inline-block">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div className="space-y-4 w-full">
                <h4 className="font-bold">Manual Entry (Optional)</h4>
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10 font-mono text-sm">
                  <span className="flex-1 opacity-60">{secret}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setStep('verify')}
                className="px-8 py-2 bg-white text-black font-bold rounded-lg hover:scale-105 transition-all"
              >
                Continue to Verification
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-8 text-center py-8">
            <div className="w-16 h-16 bg-blue-400/10 rounded-full flex items-center justify-center mx-auto text-blue-400">
              <Smartphone size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Verify Code</h3>
              <p className="text-sm text-white/40">Enter the 6-digit code from your app</p>
            </div>

            <div className="max-w-xs mx-auto space-y-4">
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-center text-3xl font-mono tracking-[0.5em] focus:outline-none focus:border-[#f27d26] transition-colors"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs justify-center">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <button 
                onClick={verifyToken}
                disabled={loading || token.length !== 6}
                className="w-full py-4 bg-[#f27d26] text-black font-bold rounded-xl hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin mx-auto" /> : 'Verify & Enable'}
              </button>
              <button 
                onClick={() => setStep('setup')}
                className="text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
              >
                Back to QR Code
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-400/10 rounded-full flex items-center justify-center mx-auto text-green-400">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">2FA Enabled Successfully</h3>
              <p className="text-sm text-white/40 leading-relaxed max-w-md mx-auto">
                Your account is now protected with two-factor authentication. You will be prompted for a code on your next login.
              </p>
            </div>
            <button 
              onClick={() => window.location.href = '/admin'}
              className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-all"
            >
              Return to Admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
