import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setOauthLoading('google');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message || 'Google sign-in failed');
      setOauthLoading('');
    }
  };

  const handleAppleLogin = async () => {
    setError('');
    setOauthLoading('apple');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message || 'Apple sign-in failed');
      setOauthLoading('');
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-100 flex items-center justify-center px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-gray-900">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to your portfolio
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}

          <Button
            variant="outline"
            className="w-full h-11 gap-3 flex items-center justify-center bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
            onClick={handleGoogleLogin}
            type="button"
            disabled={loading || oauthLoading !== ''}
          >
            {oauthLoading === 'google' ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 gap-3 flex items-center justify-center bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
            onClick={handleAppleLogin}
            type="button"
            disabled={loading || oauthLoading !== ''}
          >
            {oauthLoading === 'apple' ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <svg
                className="w-5 h-5 shrink-0 fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M17.05 12.536c-.03-3.223 2.633-4.773 2.754-4.847-1.5-2.19-3.826-2.49-4.644-2.523-1.978-.2-3.86 1.164-4.864 1.164-1.003 0-2.55-1.135-4.195-1.104-2.158.032-4.15 1.256-5.26 3.193-2.246 3.89-.572 9.641 1.614 12.798 1.07 1.553 2.347 3.297 4.02 3.235 1.612-.064 2.22-1.043 4.167-1.043 1.946 0 2.493 1.043 4.196 1.01 1.734-.03 2.83-1.57 3.89-3.128 1.23-1.796 1.736-3.537 1.766-3.628-.038-.012-3.39-1.3-3.424-5.127zM13.87 3.89c.888-1.077 1.488-2.574 1.324-4.07-1.28.052-2.83.853-3.748 1.93-.823.95-1.544 2.47-1.35 3.925 1.43.11 2.886-.727 3.774-1.785z" />
              </svg>
            )}
            <span>Continue with Apple</span>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 text-white hover:bg-gray-800"
              disabled={loading || oauthLoading !== ''}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Sign In
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <Link
              to="/forgot-password"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Forgot password?
            </Link>
            <Link
              to="/register"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Create account
            </Link>
          </div>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            By continuing, you agree to our{' '}
            <Link
              to="/legal?page=terms"
              className="underline hover:text-gray-600"
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              to="/legal?page=privacy"
              className="underline hover:text-gray-600"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
