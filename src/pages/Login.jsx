import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, Loader2, Apple } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://stock-pulse-rouge.vercel.app',
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <Button onClick={handleGoogleLogin} className="w-full" disabled={loading}>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </Button>
        </div>
      </div>
    </div>
  );
}
