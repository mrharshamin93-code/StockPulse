import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export default function AuthCallback() {
 const navigate = useNavigate();
 const { isAuthenticated, isLoadingAuth } = useAuth();

 // Step 1: Perform the OAuth exchange (only once)
 useEffect(() => {
 const handleCallback = async () => {
 try {
 const params = new URLSearchParams(window.location.search);
 const code = params.get('code');

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

 // Exchange succeeded — now wait for AuthContext to update
 // (no immediate navigate here)
 await supabase.auth.getSession(); // ensure session is synced
 } catch (err) {
 console.error('Unexpected callback error:', err);
 navigate('/login', { replace: true });
 }
 };

 handleCallback();
 }, [navigate]);

 // Step 2: Only navigate when the shared AuthContext confirms we're authenticated
 useEffect(() => {
 if (!isLoadingAuth && isAuthenticated) {
 navigate('/', { replace: true });
 }
 }, [isAuthenticated, isLoadingAuth, navigate]);

 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50">
 <div className="text-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4" />
 <p className="text-gray-600">Signing you in…</p>
 </div>
 </div>
 );
}
