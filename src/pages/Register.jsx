import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, Loader2, BarChart2, ShieldCheck, Zap } from 'lucide-react';

const FEATURES = [
  { icon: BarChart2, label: "Track your portfolio", desc: "Monitor all your holdings in one place" },
  { icon: TrendingUp, label: "Real-time insights", desc: "AI-powered stock analysis and news" },
  { icon: Zap, label: "Stock screener", desc: "Filter stocks by fundamentals and metrics" },
  { icon: ShieldCheck, label: "Secure & private", desc: "Your data is always protected" },
];

export default function Register() {
  const [step, setStep] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      alert("Registration coming soon. Use Google for now.");
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'https://6a46f22136d1e520f1b1ce65.base44.app/auth/google?redirect=/';
  };

  const handleAppleLogin = () => {
    alert("Apple login coming soon");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold text-white">StockPulse</span>
        </div>

        <div>
          <h2 className="font-heading text-4xl font-bold text-white mb-4 leading-tight">
            Your portfolio,<br />intelligently tracked.
          </h2>
          <p className="text-white/60 text-base mb-10">
            Join thousands of smart investors using StockPulse for real-time portfolio tracking, intelligent market AI insights, and automated news summaries.
          </p>
          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-white/50 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">© 2026 StockPulse. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-heading text-2xl font-bold text-gray-900">
              {step === 'register' ? 'Create Your Account' : 'Check Your Email'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'register'
                ? 'Start tracking your portfolio in minutes'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          <div className="space-y-5">
            {step === 'register' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full gap-2 h-11 bg-white text-gray-900 border-gray-300 hover:bg-gray-50" onClick={handleAppleLogin}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.3.07 2.2.73 2.98.75.82-.17 1.61-.87 2.99-.79 1.67.1 2.93.8 3.72 2.02-3.33 2.02-2.8 6.47.62 7.77-.62 1.52-1.44 3.04-2.31 3.13zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Apple
                  </Button>
                  <Button variant="outline" className="w-full gap-2 h-11 bg-white text-gray-900 border-gray-300 hover:bg-gray-50" onClick={handleGoogleLogin}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-50 px-2 text-gray-400">or</span></div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm Password</Label>
                    <Input type="password" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="h-11" />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-gray-900 text-white hover:bg-gray-800" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
                <div className="space-y-1.5">
                  <Label>Verification Code</Label>
                  <Input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required
                    placeholder="Enter 6-digit code"
                    className="h-11 text-center tracking-widest text-lg font-mono"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-gray-900 text-white hover:bg-gray-800" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Verify & Continue
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-gray-900 font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
