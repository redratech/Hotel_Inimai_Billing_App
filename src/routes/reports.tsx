import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchAllBillItems, fetchBills, formatINR } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";

type Range = "day" | "week" | "month";

export default function Reports() {
  const { data: bills = [] } = useQuery({ queryKey: ["bills"], queryFn: fetchBills });
  const { data: billItems = [] } = useQuery({ queryKey: ["bill_items"], queryFn: fetchAllBillItems });
  const [range, setRange] = useState<Range>("week");

  const since = useMemo(() => {
    const d = new Date();
    if (range === "day") d.setHours(0, 0, 0, 0);
    if (range === "week") d.setDate(d.getDate() - 6);
    if (range === "month") d.setDate(d.getDate() - 29);
    if (range !== "day") d.setHours(0, 0, 0, 0);
    return d;
  }, [range]);

  const inRange = bills.filter((b) => new Date(b.created_at) >= since);
  const billIds = new Set(inRange.map((b) => b.id));
  const itemsInRange = billItems.filter((bi) => billIds.has(bi.bill_id));

  const revenue = inRange.reduce((s, b) => s + Number(b.total_amount), 0);

  // daily series
  const days = range === "day" ? 1 : range === "week" ? 7 : 30;
  const series: { label: string; revenue: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const rev = bills.filter((b) => new Date(b.created_at).toDateString() === key).reduce((s, b) => s + Number(b.total_amount), 0);
    series.push({ label: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), revenue: rev });
  }

  const itemTotals = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const bi of itemsInRange) {
    const c = itemTotals.get(bi.item_name) ?? { name: bi.item_name, qty: 0, revenue: 0 };
    c.qty += bi.quantity; c.revenue += Number(bi.subtotal);
    itemTotals.set(bi.item_name, c);
  }
  const top = [...itemTotals.values()].sort((a, b) => b.qty - a.qty);
  const totalQty = itemsInRange.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Sales performance over time.</p>
        </div>
        <div className="flex gap-1 bg-card border rounded-full p-1">
          {(["day", "week", "month"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-4 py-1.5 text-sm font-medium rounded-full capitalize ${range === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{r === "day" ? "Today" : r === "week" ? "7 days" : "30 days"}</button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Stat label="Revenue" value={formatINR(revenue)} accent />
        <Stat label="Bills Count" value={String(inRange.length)} />
        <Stat label="Total Quantity Sold" value={String(totalQty)} />
        <Stat label="Most Sold" value={top[0]?.name ?? "—"} small />
        <Stat label="Least Sold" value={top[top.length - 1]?.name ?? "—"} small />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-card rounded-2xl p-5 border shadow-[var(--shadow-soft)]">
          <h2 className="font-bold mb-4">Revenue Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: number) => formatINR(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-5 border shadow-[var(--shadow-soft)]">
          <h2 className="font-bold mb-4">Top Item Sales</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top.slice(0, 8)} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="qty" fill="var(--accent)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border overflow-hidden shadow-[var(--shadow-soft)]">
        <div className="px-5 py-4 border-b font-bold">Item Performance</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Item</th>
                <th className="text-right px-5 py-3">Quantity</th>
                <th className="text-right px-5 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.name} className="border-t">
                  <td className="px-5 py-3 font-medium">{t.name}</td>
                  <td className="px-5 py-3 text-right">{t.qty}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatINR(t.revenue)}</td>
                </tr>
              ))}
              {top.length === 0 && <tr><td colSpan={3} className="text-center px-5 py-8 text-muted-foreground">No data in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="rounded-2xl p-4 lg:p-5 border shadow-[var(--shadow-soft)]" style={accent ? { background: "var(--gradient-primary)", color: "var(--primary-foreground)", border: "none" } : { background: "var(--card)" }}>
      <div className="text-xs uppercase tracking-wide opacity-80 font-medium">{label}</div>
      <div className={`mt-2 font-bold ${small ? "text-base" : "text-2xl lg:text-3xl"}`}>{value}</div>
    </div>
  );
}