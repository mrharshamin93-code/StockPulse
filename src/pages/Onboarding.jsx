import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, BarChart2, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";   // Add this import

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);

    // Mark onboarding as completed in Supabase
    await supabase.auth.updateUser({
      data: { onboarding_completed: true }
    });

    setTimeout(() => {
      navigate("/");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black text-white mb-6">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to StockPulse</h1>
          <p className="text-muted-foreground">Let's get you set up in 30 seconds</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <BarChart2 className="w-12 h-12 mx-auto text-black mb-4" />
                <h2 className="text-xl font-semibold mb-2">Track your portfolio</h2>
                <p className="text-muted-foreground">Add your holdings and watch them grow in real-time.</p>
              </div>
              <Button onClick={() => setStep(2)} className="w-full h-12">Continue</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto text-black mb-4" />
                <h2 className="text-xl font-semibold mb-2">Get AI insights</h2>
                <p className="text-muted-foreground">Receive daily market summaries and stock recommendations.</p>
              </div>
              <Button onClick={() => setStep(3)} className="w-full h-12">Continue</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">You're all set!</h2>
                <p className="text-muted-foreground">Start adding your first stocks to get started.</p>
              </div>
              <Button onClick={handleComplete} className="w-full h-12" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <button onClick={() => navigate("/")} className="text-sm text-muted-foreground hover:text-black">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
