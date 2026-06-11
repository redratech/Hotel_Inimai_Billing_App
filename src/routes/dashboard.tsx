import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBills, fetchAllBillItems, fetchItems, formatINR, formatDateTime } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { IndianRupee, Receipt, Utensils, TrendingUp, Crown, CalendarClock, Clock, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

async function fetchAdvanceOrders() {
  const { data, error } = await supabase.from("advance_orders").select("*").order("delivery_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export default function Dashboard() {
  const { data: bills = [] } = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: billItems = [] } = useQuery({ queryKey: ["bill_items"], queryFn: fetchAllBillItems });
  const { data: advanceOrders = [] } = useQuery({ queryKey: ["advance_orders"], queryFn: fetchAdvanceOrders });

  const todayStr = new Date().toDateString();
  const monthKey = new Date().toISOString().slice(0, 7);

  const todayBills = bills.filter((b) => new Date(b.created_at).toDateString() === todayStr);
  const todaySales = todayBills.reduce((s, b) => s + Number(b.total_amount), 0);
  
  // Payment method breakdown for today
  const todayPaymentBreakdown = {
    cash: todayBills.filter((b) => b.payment_method === "cash").reduce((s, b) => s + Number(b.total_amount), 0),
    phone_pay: todayBills.filter((b) => b.payment_method === "phone_pay").reduce((s, b) => s + Number(b.total_amount), 0),
    google_pay: todayBills.filter((b) => b.payment_method === "google_pay").reduce((s, b) => s + Number(b.total_amount), 0),
  };

  const monthlyRevenue = bills
    .filter((b) => b.created_at.startsWith(monthKey))
    .reduce((s, b) => s + Number(b.total_amount), 0);

  const itemTotals = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const bi of billItems) {
    const cur = itemTotals.get(bi.item_name) ?? { name: bi.item_name, qty: 0, revenue: 0 };
    cur.qty += bi.quantity;
    cur.revenue += Number(bi.subtotal);
    itemTotals.set(bi.item_name, cur);
  }
  const top = [...itemTotals.values()].sort((a, b) => b.qty - a.qty);
  const topItem = top[0]?.name ?? "—";

  // Advance orders metrics
  const activeAdvanceOrders = advanceOrders.filter((o) => o.status !== "cancelled");
  const advanceRevenueTotal = activeAdvanceOrders.reduce((s, o) => s + Number(o.grand_total), 0);
  const advanceReceivedTotal = activeAdvanceOrders.reduce((s, o) => s + Number(o.advance_amount), 0);
  const todayDelivery = advanceOrders.filter((o) => {
    const d = new Date(o.delivery_date + "T00:00:00").toDateString();
    return d === todayStr && o.status !== "cancelled" && o.status !== "delivered";
  });
  const upcomingDeliveries = activeAdvanceOrders
    .filter((o) => o.status !== "delivered")
    .slice(0, 5);

  // last 7 days
  const days: { day: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const rev = bills.filter((b) => new Date(b.created_at).toDateString() === key).reduce((s, b) => s + Number(b.total_amount), 0);
    days.push({ day: d.toLocaleDateString("en-IN", { weekday: "short" }), revenue: rev });
  }

  const recent = bills.slice(0, 6);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's what's happening at your hotel today.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <StatCard icon={<IndianRupee className="h-5 w-5" />} label="Today's Sales" value={formatINR(todaySales)} gradient />
        <StatCard icon={<Receipt className="h-5 w-5" />} label="Bills Today" value={String(todayBills.length)} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Monthly Revenue" value={formatINR(monthlyRevenue)} />
        <StatCard icon={<Utensils className="h-5 w-5" />} label="Menu Items" value={String(items.length)} />
        <StatCard icon={<Crown className="h-5 w-5" />} label="Top Seller" value={topItem} small />
      </div>

      {/* Advance Orders Revenue Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Advance Orders" value={String(activeAdvanceOrders.length)} gradient />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Advance Revenue" value={formatINR(advanceRevenueTotal)} />
        <StatCard icon={<Banknote className="h-5 w-5" />} label="Advance Received" value={formatINR(advanceReceivedTotal)} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Today's Deliveries" value={String(todayDelivery.length)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 bg-card rounded-2xl p-5 border shadow-[var(--shadow-soft)]">
          <h2 className="font-bold mb-4">Sales — Last 7 Days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(v: number) => formatINR(Number(v))} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Today's Payment Methods Breakdown */}
        <div className="bg-card rounded-2xl p-5 border shadow-[var(--shadow-soft)]">
          <h2 className="font-bold mb-4">Today's Payment Breakdown</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-blue-200/50">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">💵 Cash</div>
              <div className="font-bold text-lg text-blue-600">{formatINR(todayPaymentBreakdown.cash)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{todayBills.filter((b) => b.payment_method === "cash").length} transactions</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-purple-200/50">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">📱 Phone Pay</div>
              <div className="font-bold text-lg text-purple-600">{formatINR(todayPaymentBreakdown.phone_pay)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{todayBills.filter((b) => b.payment_method === "phone_pay").length} transactions</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-red-200/50">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">🔵 Google Pay</div>
              <div className="font-bold text-lg text-red-600">{formatINR(todayPaymentBreakdown.google_pay)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{todayBills.filter((b) => b.payment_method === "google_pay").length} transactions</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-card rounded-2xl p-5 border shadow-[var(--shadow-soft)]">
        <h2 className="font-bold mb-4">Top Selling Items</h2>
        {top.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No sales yet</div>
        ) : (
          <ul className="space-y-3">
            {top.slice(0, 6).map((t, i) => (
              <li key={t.name} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center font-bold text-sm">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.qty} sold · {formatINR(t.revenue)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upcoming Deliveries */}
      {upcomingDeliveries.length > 0 && (
        <div className="bg-card rounded-2xl border shadow-[var(--shadow-soft)] overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Upcoming Deliveries</h2>
            <Link to="/advance-orders" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Customer</th>
                  <th className="text-left px-5 py-3">Event</th>
                  <th className="text-left px-5 py-3">Delivery</th>
                  <th className="text-right px-5 py-3">Total</th>
                  <th className="text-right px-5 py-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {upcomingDeliveries.map((o) => {
                  const remaining = Number(o.grand_total) - Number(o.advance_amount);
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="px-5 py-3 font-semibold">{o.customer_name}<div className="text-xs text-muted-foreground font-normal">{o.mobile}</div></td>
                      <td className="px-5 py-3 text-muted-foreground">{o.event_type || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(o.delivery_date).toLocaleDateString("en-IN")} {o.delivery_time?.slice(0,5)}</td>
                      <td className="px-5 py-3 text-right font-bold">{formatINR(Number(o.grand_total))}</td>
                      <td className="px-5 py-3 text-right font-bold text-primary">{formatINR(remaining)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-bold">Recent Bills</h2>
          <Link to="/bills" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No bills yet. Start billing from the POS!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Bill #</th>
                  <th className="text-left px-5 py-3">Date & Time</th>
                  <th className="text-right px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="px-5 py-3 font-semibold">{b.bill_number}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(b.created_at)}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatINR(Number(b.total_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, gradient, small }: { icon: React.ReactNode; label: string; value: string; gradient?: boolean; small?: boolean }) {
  return (
    <div
      className="rounded-2xl p-4 lg:p-5 border shadow-[var(--shadow-soft)]"
      style={gradient ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", border: "none" } : { background: "var(--card)" }}
    >
      <div className="flex items-center gap-2 opacity-80">{icon}<span className="text-xs uppercase tracking-wide font-medium">{label}</span></div>
      <div className={`mt-2 font-bold ${small ? "text-lg" : "text-2xl lg:text-3xl"}`}>{value}</div>
    </div>
  );
}