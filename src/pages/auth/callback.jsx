import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession();

        if (error) {
          console.error("OAuth Error:", error);
          navigate(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }

        // Success - redirect to home
        navigate('/', { replace: true });
      } catch (err) {
        console.error("Unexpected error in callback:", err);
        navigate('/login?error=unexpected_error');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you in with Google...</p>
      </div>
    </div>
  );
}
