import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession();

      if (error) {
        console.error("=== AUTH CALLBACK ERROR ===", error);
        // Show the real error in the URL for debugging
        navigate(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      console.log("Auth success:", data);
      navigate('/', { replace: true });
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Processing login...</p>
    </div>
  );
}
