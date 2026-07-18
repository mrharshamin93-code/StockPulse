import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const user = session.user;

        // Check if user has completed onboarding (you can store this in user metadata or a profile table)
        const hasCompletedOnboarding = user.user_metadata?.onboarding_completed === true;

        if (hasCompletedOnboarding) {
          navigate('/', { replace: true });        // Go to Watchlist / Home
        } else {
          navigate('/onboarding', { replace: true }); // First time user
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return <div className="min-h-screen flex items-center justify-center">Completing login...</div>;
}
