import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart3, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: Add real reset later
      alert("Password reset link sent! (Demo)");
      setSent(true);
    } catch (err) {
      alert("Error sending reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1">We'll send you a reset link</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">If an account exists with that email, you'll receive a reset link shortly.</p>
              <Link to="/login"><Button variant="outline" className="mt-4">Back to Sign In</Button></Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}
          <div className="text-center text-sm">
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
