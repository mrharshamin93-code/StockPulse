import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let timeoutId;

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const nextParam = params.get('next');

        if (!code) {
          navigate('/login', { replace: true });
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('OAuth Error:', error);
          setStatus('error');
          setMessage('Sign-in failed. Redirecting...');
          setTimeout(() => navigate('/login', { replace: true }), 1200);
          return;
        }

        await supabase.auth.getSession();
        setStatus('success');
        setMessage('Almost there...');

      } catch (err) {
        console.error('Unexpected callback error:', err);
        setStatus('error');
        setMessage('Something went wrong. Redirecting...');
        setTimeout(() => navigate('/login', { replace: true }), 1200);
      }
    };

    handleCallback();

    // 15-second timeout fallback (prevents infinite loading)
    timeoutId = setTimeout(() => {
      if (status !== 'success') {
        console.warn('Auth callback timed out');
        setStatus('error');
        setMessage('Taking too long. Redirecting to login...');
        navigate('/login', { replace: true });
      }
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [navigate]);

  // Navigate only when AuthContext confirms authentication + support ?next=
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      let next = params.get('next') || '/';

      // Safety: only allow relative internal paths
      if (!next.startsWith('/')) {
        next = '/';
      }

      navigate(next, { replace: true });
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
        {status === 'error' && (
          <p className="text-sm text-red-500 mt-2">Please try signing in again.</p>
        )}
      </div>
    </div>
  );
}
