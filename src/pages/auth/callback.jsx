import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        // Not an OAuth callback
        if (!code) {
          navigate('/login', { replace: true });
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('OAuth Error:', error);
          navigate('/login', { replace: true });
          return;
        }

        // === KEY FIX: Confirm session is fully set before navigating ===
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          navigate('/', { replace: true });
        } else {
          console.error('No session after successful exchange');
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Unexpected callback error:', err);
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
        <p className="text-gray-600">Signing you in…</p>
      </div>
    </div>
  );
}
