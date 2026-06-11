import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, CalendarClock, Pencil, Bell, BellOff, AlarmClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatINR } from "@/lib/db";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snacks", "Sweet", "Juice", "Beverages"] as const;
const UNITS = ["Plate", "Kg", "Liter", "Piece", "Packet", "Box", "Cup"] as const;
const STATUSES = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-500/20 dark:text-blue-200",
  preparing: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/20 dark:text-orange-200",
  ready: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200",
  delivered: "bg-green-100 text-green-900 border-green-300 dark:bg-green-500/20 dark:text-green-200",
  cancelled: "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-200",
};

interface AdvanceOrder {
  id: string;
  customer_name: string;
  mobile: string;
  event_type: string | null;
  delivery_date: string;
  delivery_time: string;
  address: string | null;
  notes: string | null;
  status: Status;
  sub_total: number;
  advance_amount: number;
  grand_total: number;
  advance_payment_method: string | null;
  balance_payment_method: string | null;
  created_at: string;
}
interface AdvanceOrderItem {
  id: string;
  order_id: string;
  category: string;
  item_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_amount: number;
  notes: string | null;
}

interface DraftItem {
  id?: string;
  category: string;
  item_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  notes: string;
}

function emptyDraftItem(): DraftItem {
  return { category: "Breakfast", item_name: "", quantity: 1, unit: "Plate", price_per_unit: 0, notes: "" };
}

async function fetchOrders(): Promise<AdvanceOrder[]> {
  const { data, error } = await supabase
    .from("advance_orders")
    .select("*")
    .order("delivery_date", { ascending: true })
    .order("delivery_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdvanceOrder[];
}
async function fetchItems(orderId: string): Promise<AdvanceOrderItem[]> {
  const { data, error } = await supabase.from("advance_order_items").select("*").eq("order_id", orderId);
  if (error) throw error;
  return (data ?? []) as AdvanceOrderItem[];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function deliveryDate(o: { delivery_date: string; delivery_time: string }): Date {
  const t = (o.delivery_time || "00:00").slice(0, 5);
  return new Date(`${o.delivery_date}T${t}:00`);
}

function hoursUntil(o: { delivery_date: string; delivery_time: string }): number {
  return (deliveryDate(o).getTime() - Date.now()) / 3600000;
}

function formatCountdown(hrs: number): string {
  if (hrs < 0) {
    const h = Math.abs(hrs);
    if (h < 1) return `${Math.round(h * 60)}m overdue`;
    return `${h.toFixed(h < 10 ? 1 : 0)}h overdue`;
  }
  if (hrs < 1) return `in ${Math.max(1, Math.round(hrs * 60))}m`;
  if (hrs < 24) return `in ${hrs.toFixed(hrs < 10 ? 1 : 0)}h`;
  const d = Math.floor(hrs / 24);
  return `in ${d}d ${Math.round(hrs - d * 24)}h`;
}

function formatDateLabel(d: string) {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function hashStamp(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

export default function AdvanceOrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: ["advance_orders"], queryFn: fetchOrders });

  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editing, setEditing] = useState<AdvanceOrder | null>(null);
  const [open, setOpen] = useState(false);
  const [reminderHours, setReminderHours] = useState<number>(() => {
    const v = Number(localStorage.getItem("advOrders.reminderHours"));
    return Number.isFinite(v) && v > 0 ? v : 24;
  });
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(
    () => localStorage.getItem("advOrders.notify") === "1",
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    localStorage.setItem("advOrders.reminderHours", String(reminderHours));
  }, [reminderHours]);
  useEffect(() => {
    localStorage.setItem("advOrders.notify", notifyEnabled ? "1" : "0");
  }, [notifyEnabled]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  async function toggleNotifications() {
    if (notifyEnabled) {
      setNotifyEnabled(false);
      toast.success("Reminders muted");
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyEnabled(true);
      toast.success("Reminders enabled (in-app)");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setNotifyEnabled(true);
    toast.success(perm === "granted" ? "Browser notifications enabled" : "Reminders enabled (in-app only)");
  }

  useEffect(() => {
    const ch = supabase
      .channel("advance_orders_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "advance_orders" }, () =>
        qc.invalidateQueries({ queryKey: ["advance_orders"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "advance_order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["advance_order_items"] });
        qc.invalidateQueries({ queryKey: ["advance_orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const upcoming = useMemo(() => {
    return orders
      .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
      .map((o) => ({ o, hrs: hoursUntil(o) }))
      .filter(({ hrs }) => hrs <= reminderHours && hrs > -2)
      .sort((a, b) => a.hrs - b.hrs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, reminderHours, now]);

  // Fire one-time reminders per order entering the window
  useEffect(() => {
    if (!notifyEnabled) return;
    const KEY = "advOrders.notified";
    let fired: Record<string, number> = {};
    try { fired = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
    let changed = false;
    for (const { o, hrs } of upcoming) {
      const stamp = `${reminderHours}:${o.delivery_date}T${o.delivery_time}`;
      if (fired[o.id] === undefined || fired[o.id] !== hashStamp(stamp)) {
        const title = `Upcoming: ${o.customer_name}`;
        const body = `${formatCountdown(hrs)} · ${o.delivery_time.slice(0,5)}${o.event_type ? " · " + o.event_type : ""}`;
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(title, { body, tag: `adv-${o.id}` });
          }
        } catch {}
        toast.message(title, { description: body, icon: "🔔" });
        fired[o.id] = hashStamp(stamp);
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(fired));
  }, [upcoming, notifyEnabled, reminderHours]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (s && !o.customer_name.toLowerCase().includes(s) && !o.mobile.toLowerCase().includes(s)) return false;
      if (filterDate && o.delivery_date !== filterDate) return false;
      if (filterStatus !== "all" && o.status !== filterStatus) return false;
      return true;
    });
  }, [orders, search, filterDate, filterStatus]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdvanceOrder[]>();
    for (const o of filtered) {
      if (!map.has(o.delivery_date)) map.set(o.delivery_date, []);
      map.get(o.delivery_date)!.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = orders.filter((o) => o.delivery_date === todayStr && o.status !== "cancelled" && o.status !== "delivered").length;

  async function updateStatus(id: string, status: Status) {
    const { error } = await supabase.from("advance_orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Status updated");
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Advance Orders</h1>
          <p className="text-muted-foreground">
            Future orders for events & catering. <span className="font-medium text-foreground">{todayCount}</span> scheduled for today.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Advance Order
        </Button>
      </header>

      <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold leading-tight">Reminders</div>
              <div className="text-xs text-muted-foreground">
                Orders due within the next <span className="font-medium text-foreground">{reminderHours}h</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="rem-hrs" className="text-xs text-muted-foreground">Window</Label>
            <Select value={String(reminderHours)} onValueChange={(v) => setReminderHours(Number(v))}>
              <SelectTrigger id="rem-hrs" className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 6, 12, 24, 48, 72].map((h) => (
                  <SelectItem key={h} value={String(h)}>{h} hour{h === 1 ? "" : "s"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant={notifyEnabled ? "default" : "outline"} size="sm" onClick={toggleNotifications} className="gap-1.5">
              {notifyEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {notifyEnabled ? "On" : "Off"}
            </Button>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-sm text-muted-foreground">No orders due in the next {reminderHours} hours.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {upcoming.map(({ o, hrs }) => {
              const urgent = hrs <= Math.min(2, reminderHours);
              return (
                <button
                  key={o.id}
                  onClick={() => { setEditing(o); setOpen(true); }}
                  className={cn(
                    "text-left rounded-xl border px-3 py-2 flex items-center justify-between gap-3 transition-colors",
                    urgent
                      ? "bg-destructive/10 border-destructive/40 hover:bg-destructive/15 animate-pulse"
                      : "bg-primary/5 border-primary/30 hover:bg-primary/10",
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1.5">
                      <Bell className={cn("h-3.5 w-3.5", urgent ? "text-destructive" : "text-primary")} />
                      {o.customer_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {o.mobile} · {formatDateLabel(o.delivery_date)} {o.delivery_time.slice(0,5)}
                      {o.event_type ? ` · ${o.event_type}` : ""}
                    </div>
                  </div>
                  <div className={cn("text-xs font-bold whitespace-nowrap px-2 py-1 rounded-md",
                    urgent ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>
                    {formatCountdown(hrs)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search customer or mobile…" className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-card" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 ? (
        <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No advance orders found.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, list]) => {
            const days = daysUntil(date);
            const dayLabel = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days < 0 ? `${-days} day${-days === 1 ? "" : "s"} ago` : `in ${days} days`;
            return (
              <section key={date}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h2 className="text-lg font-semibold">{formatDateLabel(date)}</h2>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", days === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {dayLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} onEdit={() => { setEditing(o); setOpen(true); }} onStatus={(s) => updateStatus(o.id, s)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <OrderDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["advance_orders"] })} />
    </div>
  );
}

function OrderCard({ order, onEdit, onStatus }: { order: AdvanceOrder; onEdit: () => void; onStatus: (s: Status) => void }) {
  const { data: items = [] } = useQuery({ queryKey: ["advance_order_items", order.id], queryFn: () => fetchItems(order.id) });
  const [balancePaymentDialogOpen, setBalancePaymentDialogOpen] = useState(false);
  const [balancePaymentMethod, setBalancePaymentMethod] = useState("cash");
  const remaining = Number(order.grand_total) - Number(order.advance_amount);

  async function saveBalancePayment() {
    if (remaining <= 0) {
      toast.error("No balance to pay");
      return;
    }
    const { error } = await supabase
      .from("advance_orders")
      .update({ balance_payment_method: balancePaymentMethod })
      .eq("id", order.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Balance payment method recorded");
      setBalancePaymentDialogOpen(false);
    }
  }

  return (
    <div className="bg-card border rounded-2xl p-4 shadow-[var(--shadow-soft)] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{order.customer_name}</div>
          <div className="text-xs text-muted-foreground">{order.mobile} · {order.delivery_time.slice(0, 5)}{order.event_type ? ` · ${order.event_type}` : ""}</div>
        </div>
        <Badge variant="outline" className={cn("capitalize border", STATUS_STYLE[order.status])}>{order.status}</Badge>
      </div>
      {order.address && <div className="text-xs text-muted-foreground line-clamp-2">{order.address}</div>}
      
      {items.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5 border border-muted">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Items</div>
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="text-xs flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.item_name}</div>
                  <div className="text-muted-foreground text-[0.7rem]">{item.category}</div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold">{item.quantity} {item.unit}</div>
                  <div className="text-muted-foreground text-[0.7rem]">{formatINR(item.total_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2"><div className="text-muted-foreground">Total</div><div className="font-semibold">{formatINR(Number(order.grand_total))}</div></div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground">Advance</div>
          <div className="font-semibold">{formatINR(Number(order.advance_amount))}</div>
          {order.advance_payment_method && <div className="text-[0.65rem] text-primary capitalize">{order.advance_payment_method.replace("_", " ")}</div>}
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground">Balance</div>
          <div className="font-semibold text-primary">{formatINR(remaining)}</div>
          {order.balance_payment_method && <div className="text-[0.65rem] text-primary capitalize">{order.balance_payment_method.replace("_", " ")}</div>}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={order.status} onValueChange={(v) => onStatus(v as Status)}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        {remaining > 0 && (
          <Button size="sm" onClick={() => setBalancePaymentDialogOpen(true)} className="gap-1 whitespace-nowrap">
            Pay Balance
          </Button>
        )}
      </div>

      <Dialog open={balancePaymentDialogOpen} onOpenChange={setBalancePaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Balance Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Balance Amount: <span className="font-bold text-primary text-lg">{formatINR(remaining)}</span>
            </div>
            <div className="space-y-2">
              {["Cash", "Phone Pay", "Google Pay"].map((method) => (
                <button
                  key={method}
                  onClick={() => setBalancePaymentMethod(method.toLowerCase().replace(" ", "_"))}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border-2 transition-colors text-left font-medium",
                    balancePaymentMethod === method.toLowerCase().replace(" ", "_")
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setBalancePaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBalancePayment}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing: AdvanceOrder | null; onSaved: () => void }) {
  const [customer, setCustomer] = useState("");
  const [mobile, setMobile] = useState("");
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [advance, setAdvance] = useState(0);
  const [items, setItems] = useState<DraftItem[]>([emptyDraftItem()]);
  const [saving, setSaving] = useState(false);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState("cash");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCustomer(editing.customer_name);
      setMobile(editing.mobile);
      setEventType(editing.event_type ?? "");
      setDate(editing.delivery_date);
      setTime(editing.delivery_time.slice(0, 5));
      setAddress(editing.address ?? "");
      setNotes(editing.notes ?? "");
      setStatus(editing.status);
      setAdvance(Number(editing.advance_amount));
      setAdvancePaymentMethod(editing.advance_payment_method ?? "cash");
      fetchItems(editing.id).then((rows) => {
        setItems(rows.length ? rows.map((r) => ({
          id: r.id, category: r.category, item_name: r.item_name, quantity: Number(r.quantity),
          unit: r.unit, price_per_unit: Number(r.price_per_unit), notes: r.notes ?? "",
        })) : [emptyDraftItem()]);
      });
    } else {
      setCustomer(""); setMobile(""); setEventType(""); setDate(""); setTime("");
      setAddress(""); setNotes(""); setStatus("pending"); setAdvance(0);
      setItems([emptyDraftItem()]);
    }
  }, [open, editing]);

  const subTotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.price_per_unit || 0), 0);
  const grand = subTotal;
  const balance = grand - Number(advance || 0);

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() { setItems((p) => [...p, emptyDraftItem()]); }
  function removeRow(i: number) { setItems((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p); }

  async function save() {
    if (!customer.trim() || !mobile.trim() || !date || !time) {
      toast.error("Customer, mobile, date and time are required");
      return;
    }
    const validItems = items.filter((it) => it.item_name.trim() && Number(it.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    // Show payment dialog if advance amount > 0
    if (Number(advance) > 0) {
      setPaymentDialogOpen(true);
      setPendingPayload({ validItems });
      return;
    }

    await saveWithPayment(null, validItems);
  }

  async function saveWithPayment(paymentMethod: string | null, validItems: DraftItem[]) {
    setSaving(true);
    try {
      const payload = {
        customer_name: customer.trim(),
        mobile: mobile.trim(),
        event_type: eventType.trim() || null,
        delivery_date: date,
        delivery_time: time,
        address: address.trim() || null,
        notes: notes.trim() || null,
        status,
        sub_total: subTotal,
        advance_amount: Number(advance) || 0,
        grand_total: grand,
        advance_payment_method: paymentMethod || null,
      };
      let orderId: string;
      if (editing) {
        const { error } = await supabase.from("advance_orders").update(payload).eq("id", editing.id);
        if (error) throw error;
        orderId = editing.id;
        await supabase.from("advance_order_items").delete().eq("order_id", orderId);
      } else {
        const { data, error } = await supabase.from("advance_orders").insert(payload).select().single();
        if (error) throw error;
        orderId = data!.id;
      }
      const rows = validItems.map((it) => ({
        order_id: orderId,
        category: it.category,
        item_name: it.item_name.trim(),
        quantity: Number(it.quantity),
        unit: it.unit,
        price_per_unit: Number(it.price_per_unit) || 0,
        total_amount: Number(it.quantity) * (Number(it.price_per_unit) || 0),
        notes: it.notes.trim() || null,
      }));
      const { error: ie } = await supabase.from("advance_order_items").insert(rows);
      if (ie) throw ie;
      toast.success(editing ? "Order updated" : "Order created");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Advance Order" : "New Advance Order"}</DialogTitle></DialogHeader>

          <div className="space-y-5">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Customer Name *</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Mobile Number *</Label><Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" /></div>
            <div className="space-y-1.5"><Label>Event Type</Label><Input placeholder="Wedding, Birthday…" value={eventType} onChange={(e) => setEventType(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Delivery Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Delivery Time *</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Order Items</h3>
              <Button size="sm" variant="outline" onClick={addRow} className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => {
                const total = Number(it.quantity || 0) * Number(it.price_per_unit || 0);
                return (
                  <div key={i} className="border rounded-xl p-3 bg-muted/30 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-3">
                        <Label className="text-xs">Category</Label>
                        <Select value={it.category} onValueChange={(v) => updateItem(i, { category: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 sm:col-span-4">
                        <Label className="text-xs">Item Name</Label>
                        <Input value={it.item_name} onChange={(e) => updateItem(i, { item_name: e.target.value })} placeholder="Idly, Dosa…" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={0} value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Unit</Label>
                        <Select value={it.unit} onValueChange={(v) => updateItem(i, { unit: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-1 flex sm:block items-end justify-end">
                        <Button size="icon" variant="ghost" onClick={() => removeRow(i)} aria-label="Remove" disabled={items.length === 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Price / Unit</Label>
                        <Input type="number" min={0} value={it.price_per_unit} onChange={(e) => updateItem(i, { price_per_unit: Number(e.target.value) })} />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Item Notes</Label>
                        <Input value={it.notes} onChange={(e) => updateItem(i, { notes: e.target.value })} />
                      </div>
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Total</Label>
                        <div className="h-9 px-3 flex items-center font-semibold bg-background rounded-md border">{formatINR(total)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/40 rounded-xl p-4">
            <div>
              <Label className="text-xs">Sub Total</Label>
              <div className="h-9 flex items-center font-semibold">{formatINR(subTotal)}</div>
            </div>
            <div>
              <Label className="text-xs">Grand Total</Label>
              <div className="h-9 flex items-center font-bold text-primary">{formatINR(grand)}</div>
            </div>
            <div>
              <Label className="text-xs">Advance Amount</Label>
              <Input type="number" min={0} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Remaining Balance</Label>
              <div className="h-9 flex items-center font-bold">{formatINR(balance)}</div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update Order" : "Create Order"}</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* Advance payment method dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Advance Payment Method</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Advance Amount: <span className="font-bold text-primary text-lg">{formatINR(Number(advance) || 0)}</span>
          </div>
          <div className="space-y-2">
            {["Cash", "Phone Pay", "Google Pay"].map((method) => (
              <button
                key={method}
                onClick={() => setAdvancePaymentMethod(method.toLowerCase().replace(" ", "_"))}
                className={cn(
                  "w-full px-4 py-3 rounded-lg border-2 transition-colors text-left font-medium",
                  advancePaymentMethod === method.toLowerCase().replace(" ", "_")
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted hover:border-primary/50"
                )}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setPaymentDialogOpen(false);
              if (pendingPayload) {
                saveWithPayment(advancePaymentMethod, pendingPayload.validItems);
              }
            }}
            disabled={saving}
          >
            Confirm & Save
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}