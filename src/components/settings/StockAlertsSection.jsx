import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Loader2, TrendingUp, TrendingDown } from "lucide-react";

export default function StockAlertsSection({ hideLabel }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [condition, setCondition] = useState("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const data = await base44.entities.StockAlert.filter({ created_by_id: user.id }, "-created_date");
    setAlerts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.StockAlert.create({
      ticker: ticker.trim().toUpperCase(),
      condition,
      target_price: parseFloat(targetPrice),
      enabled: true,
      triggered: false,
    });
    setSaving(false);
    setOpen(false);
    setTicker(""); setCondition("above"); setTargetPrice("");
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.StockAlert.delete(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleToggle = async (alert) => {
    await base44.entities.StockAlert.update(alert.id, { enabled: !alert.enabled });
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        {!hideLabel && <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Price Alerts</p>}
        {hideLabel && <div />}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 transition-colors px-2.5 py-1.5 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Add Alert
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="w-7 h-7 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No alerts set. Add one to get notified when a stock hits your target price.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 px-5 py-4 min-h-[60px]">
                <div                   className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${alert.triggered ? "bg-gray-100" : alert.enabled ? "bg-amber-50" : "bg-gray-100"}`}>
                  {alert.condition === "above"
                    ? <TrendingUp className={`w-4 h-4 ${alert.triggered ? "text-gray-400" : alert.enabled ? "text-amber-500" : "text-gray-400"}`} />
                    : <TrendingDown className={`w-4 h-4 ${alert.triggered ? "text-gray-400" : alert.enabled ? "text-amber-500" : "text-gray-400"}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${!alert.enabled ? "text-gray-400" : ""}`}>
                    {alert.ticker} <span className="font-normal text-gray-400">{alert.condition}</span> ${alert.target_price.toFixed(2)}
                  </p>
                  {alert.triggered && <p className="text-xs text-gray-400">Triggered</p>}
                  {!alert.triggered && (
                    <button onClick={() => handleToggle(alert)} className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
                      {alert.enabled ? "Enabled · tap to disable" : "Disabled · tap to enable"}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">New Price Alert</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input
                placeholder="AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                required
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCondition("above")}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${condition === "above" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"}`}
                >
                  Price Above
                </button>
                <button
                  type="button"
                  onClick={() => setCondition("below")}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${condition === "below" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"}`}
                >
                  Price Below
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Price ($)</Label>
              <Input
                type="number"
                step="any"
                min="0.01"
                placeholder="150.00"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !ticker || !targetPrice}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Alert
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}