import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Minus, Plus, Plus as PlusIcon, ReceiptText, ShoppingBag, ShoppingCart, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createAccountHolderBill,
  fetchAccountHolderBillItems,
  fetchAccountHolderBills,
  fetchAccountHolders,
  fetchAllAccountHolderBills,
  formatDateTime,
  formatINR,
  itemsQuery,
  payAccountHolderBill,
  thumbUrl,
  type CartLine,
  type MenuItem,
} from "@/lib/db";

type CartLineUI = CartLine & { key: string };

export default function AccountHolderDetailPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { holderId } = useParams<{ holderId?: string }>();

  const { data: items = [], isLoading } = useQuery(itemsQuery);
  const { data: holders = [] } = useQuery({ queryKey: ["account_holders"], queryFn: fetchAccountHolders });
  const { data: allBills = [] } = useQuery({ queryKey: ["account_holder_bills_all"], queryFn: fetchAllAccountHolderBills });

  const [cart, setCart] = useState<CartLineUI[]>([]);
  const [picker, setPicker] = useState<MenuItem | null>(null);
  const [pickQty, setPickQty] = useState("1");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentBillId, setPaymentBillId] = useState<string | null>(null);
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cartOpen, setCartOpen] = useState(false);

  const { data: bills = [] } = useQuery({
    queryKey: ["account_holder_bills", holderId],
    queryFn: () => fetchAccountHolderBills(holderId!),
    enabled: !!holderId,
  });

  const selectedHolder = holders.find((holder) => holder.id === holderId) ?? null;
  const activeBill = bills.find((bill) => bill.id === activeBillId) ?? null;
  const totalOutstanding = bills.reduce((sum, bill) => sum + Number(bill.balance_amount ?? 0), 0);

  const { data: activeItems = [] } = useQuery({
    queryKey: ["account_holder_bill_items", activeBill?.id],
    queryFn: () => fetchAccountHolderBillItems(activeBill!.id),
    enabled: !!activeBill,
  });

  useEffect(() => {
    setCart([]);
    setPaymentDialogOpen(false);
    setPaymentBillId(null);
    setActiveBillId(null);
    setHistoryOpen(false);
  }, [holderId]);

  const filteredItems = useMemo(() => items.filter((item) => item.status === "active"), [items]);
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function openPicker(item: MenuItem) {
    setPicker(item);
    setPickQty("1");
  }

  function confirmPicker() {
    if (!picker) return;
    const qty = Math.max(1, Number.parseInt(pickQty, 10) || 1);
    const key = `${picker.id}-${Date.now()}`;
    setCart((existing) => [...existing, { key, item_id: picker.id, item_name: picker.name, price: Number(picker.price), quantity: qty }]);
    setPicker(null);
  }

  function changeQty(key: string, amount: number) {
    setCart((existing) => existing.map((line) => line.key === key ? { ...line, quantity: Math.max(0, line.quantity + amount) } : line).filter((line) => line.quantity > 0));
  }

  function removeLine(key: string) {
    setCart((existing) => existing.filter((line) => line.key !== key));
  }

  const createBillMut = useMutation({
    mutationFn: () => createAccountHolderBill(holderId!, cart.map(({ key, ...line }) => line)),
    onSuccess: async () => {
      toast.success("Account bill created");
      setCart([]);
      await qc.invalidateQueries({ queryKey: ["account_holder_bills", holderId] });
      await qc.invalidateQueries({ queryKey: ["account_holder_bills_all"] });
      await qc.invalidateQueries({ queryKey: ["account_holders"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Failed to save account bill"),
  });

  const cartPanel = (
    <div className="flex flex-col h-full bg-card">
      <SheetTitle className="sr-only">Current account bill</SheetTitle>
      <SheetDescription className="sr-only">Review and save the selected holder’s current bill.</SheetDescription>
      <div className="px-5 py-4 border-b flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <div className="font-bold text-lg">Current Account Bill</div>
        <Badge variant="secondary" className="ml-auto">{cart.length} items</Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Tap menu items to start this holder’s bill
            </div>
          )}
          {cart.map((line) => (
            <div key={line.key} className="rounded-xl border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{line.item_name}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(Number(line.price))} × {line.quantity}</div>
                </div>
                <button onClick={() => removeLine(line.key)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(line.key, -1)} className="h-8 w-8 rounded-md border bg-background hover:bg-muted flex items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
                  <div className="w-8 text-center font-medium">{line.quantity}</div>
                  <button onClick={() => changeQty(line.key, 1)} className="h-8 w-8 rounded-md border bg-background hover:bg-muted flex items-center justify-center"><PlusIcon className="h-3.5 w-3.5" /></button>
                </div>
                <div className="font-bold">{formatINR(Number(line.price) * line.quantity)}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t space-y-3 bg-card">
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Items</span><span>{cartCount}</span></div>
        <div className="flex items-center justify-between text-2xl font-bold"><span>Total</span><span className="text-primary">{formatINR(total)}</span></div>
        <Button className="w-full" onClick={() => createBillMut.mutate()} disabled={!cart.length || createBillMut.isPending}>Save account bill</Button>
      </div>
    </div>
  );

  const payMut = useMutation({
    mutationFn: ({ billId, amount, method }: { billId: string; amount: number; method: string }) => payAccountHolderBill(billId, amount, method),
    onSuccess: async () => {
      toast.success("Payment recorded");
      setPaymentDialogOpen(false);
      setPaymentBillId(null);
      setPaymentAmount("");
      await qc.invalidateQueries({ queryKey: ["account_holder_bills", holderId] });
      await qc.invalidateQueries({ queryKey: ["account_holder_bills_all"] });
      await qc.invalidateQueries({ queryKey: ["account_holders"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Failed to record payment"),
  });

  if (!selectedHolder) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Button variant="outline" onClick={() => navigate("/accounts")} className="gap-2"><ArrowLeft className="h-4 w-4" />Back to accounts</Button>
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Account holder not found.</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <Button variant="outline" onClick={() => navigate("/accounts")} className="gap-2 mb-3"><ArrowLeft className="h-4 w-4" />Back to list</Button>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{selectedHolder.name}</h1>
          <p className="text-muted-foreground">Create account bills, view unpaid balances, and record payments for this holder.</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] text-right min-w-[220px]">
          <div className="text-xs uppercase tracking-[0.25em] text-primary">Outstanding</div>
          <div className="text-2xl font-bold text-primary">{formatINR(totalOutstanding)}</div>
          <div className="text-xs text-muted-foreground">{bills.length} bills · {allBills.filter((bill) => bill.account_holder_id === selectedHolder.id).length} total</div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary">Holder details</p>
                <h2 className="text-xl font-semibold">{selectedHolder.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedHolder.phone || "No phone number"}</p>
              </div>
              <Button size="sm" onClick={() => setHistoryOpen(true)} className="gap-1">Bill History</Button>
            </div>
            {selectedHolder.description && <p className="text-sm text-muted-foreground">{selectedHolder.description}</p>}
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Create account bill</h3>
                <p className="text-xs text-muted-foreground">Pick menu items to create a new bill for this holder.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">{cartCount} items</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {isLoading && <div className="text-sm text-muted-foreground">Loading menu…</div>}
              {filteredItems.map((item) => (
                <button key={item.id} onClick={() => openPicker(item)} className="rounded-2xl border bg-background p-3 text-left hover:border-primary/60 transition-colors">
                  <img src={thumbUrl(item.image_url, 180)} alt={item.name} className="h-24 w-full rounded-xl object-cover bg-muted" />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                      <div className="font-semibold">{item.name}</div>
                    </div>
                    <span className="text-sm font-bold text-primary">{formatINR(Number(item.price))}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] space-y-4 h-fit">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-primary" />Current account bill</div>
          <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
            {cart.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Choose items from the menu to create this holder’s bill.</div>}
            {cart.map((line) => (
              <div key={line.key} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{line.item_name}</div>
                    <div className="text-xs text-muted-foreground">{formatINR(Number(line.price))} × {line.quantity}</div>
                  </div>
                  <button onClick={() => removeLine(line.key)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(line.key, -1)} className="h-8 w-8 rounded-md border bg-background hover:bg-muted flex items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
                    <div className="w-8 text-center font-semibold">{line.quantity}</div>
                    <button onClick={() => changeQty(line.key, 1)} className="h-8 w-8 rounded-md border bg-background hover:bg-muted flex items-center justify-center"><PlusIcon className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="font-semibold">{formatINR(Number(line.price) * line.quantity)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span>Items</span><strong>{cartCount}</strong></div>
            <div className="flex items-center justify-between text-lg font-bold"><span>Total</span><span className="text-primary">{formatINR(total)}</span></div>
          </div>
          <Button className="w-full" onClick={() => createBillMut.mutate()} disabled={!cart.length || createBillMut.isPending}>Save account bill</Button>
        </aside>
      </div>

      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">Use this page to create a fresh bill, review the holder’s history, and pay any remaining balance.</div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden fixed bottom-4 inset-x-4 z-30 h-14 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] flex items-center justify-between px-5 active:scale-[0.98] transition-transform" aria-label="Open current account bill">
            <div className="flex items-center gap-2">
              <div className="relative"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}</div>
              <span className="font-semibold">View Current Bill</span>
            </div>
            <span className="font-bold text-lg">{formatINR(total)}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="p-0 h-[88vh] rounded-t-2xl flex flex-col">
          {cartPanel}
        </SheetContent>
      </Sheet>

      <Dialog open={!!picker} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add item</DialogTitle></DialogHeader>
          {picker && (
            <div className="space-y-4">
              <img src={thumbUrl(picker.image_url, 160)} alt={picker.name} className="h-20 w-20 rounded-xl object-cover" />
              <div>
                <div className="font-semibold">{picker.name}</div>
                <div className="text-sm text-muted-foreground">{formatINR(Number(picker.price))}</div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="icon" onClick={() => setPickQty((value) => String(Math.max(1, Number.parseInt(value, 10) || 1) - 1))}><Minus className="h-4 w-4" /></Button>
                <Input type="number" inputMode="numeric" min={1} value={pickQty} onChange={(e) => setPickQty(e.target.value)} className="w-20 text-center" autoFocus />
                <Button type="button" variant="outline" size="icon" onClick={() => setPickQty((value) => String((Number.parseInt(value, 10) || 0) + 1))}><PlusIcon className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicker(null)}>Cancel</Button>
            <Button onClick={confirmPicker}>Add to bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Bill History · {selectedHolder.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-auto pr-1">
            {bills.map((bill) => (
              <article key={bill.id} className="rounded-2xl border p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{bill.bill_number}</div>
                    <div className="font-semibold">{formatINR(Number(bill.total_amount))} total</div>
                    <div className="text-xs text-muted-foreground">Created {formatDateTime(bill.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2.5 py-1 capitalize">{bill.status.replace("_", " ")}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1">Paid {formatINR(Number(bill.paid_amount))}</span>
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700">Balance {formatINR(Number(bill.balance_amount))}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">{bill.payment_method ? `Payment mode: ${bill.payment_method.replace("_", " ")}` : "No payment mode recorded yet"}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setActiveBillId(bill.id); setHistoryOpen(false); }} className="gap-1"><Eye className="h-3.5 w-3.5" />View</Button>
                    <Button size="sm" variant="outline" onClick={() => { setPaymentBillId(bill.id); setPaymentAmount(String(Number(bill.balance_amount || 0))); setPaymentDialogOpen(true); setHistoryOpen(false); }} disabled={Number(bill.balance_amount) <= 0}>Pay balance</Button>
                  </div>
                </div>
              </article>
            ))}
            {!bills.length && <div className="text-sm text-muted-foreground py-6 text-center">No account bills for this holder yet.</div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeBill} onOpenChange={(open) => !open && setActiveBillId(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{activeBill?.bill_number}</DialogTitle></DialogHeader>
          {activeBill && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{formatDateTime(activeBill.created_at)}</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-muted/50 p-3"><div className="text-muted-foreground">Total</div><div className="font-semibold">{formatINR(Number(activeBill.total_amount))}</div></div>
                <div className="rounded-xl bg-muted/50 p-3"><div className="text-muted-foreground">Balance</div><div className="font-semibold text-primary">{formatINR(Number(activeBill.balance_amount))}</div></div>
              </div>
              <div className="border rounded-xl divide-y max-h-64 overflow-auto">
                {activeItems.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground">{formatINR(Number(item.price))} × {item.quantity}</div>
                    </div>
                    <div className="font-semibold">{formatINR(Number(item.subtotal))}</div>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => { setPaymentBillId(activeBill.id); setPaymentAmount(String(Number(activeBill.balance_amount || 0))); setPaymentDialogOpen(true); setActiveBillId(null); }} disabled={Number(activeBill.balance_amount) <= 0}>Pay balance</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" min={1} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div>
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['cash', 'phone_pay', 'google_pay'].map((method) => (
                  <button key={method} onClick={() => setPaymentMethod(method)} className={cn("rounded-xl border px-3 py-2 text-sm capitalize", paymentMethod === method ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{method.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (!paymentBillId) return; const amount = Number(paymentAmount || 0); if (!amount || amount <= 0) return toast.error("Enter a valid amount"); payMut.mutate({ billId: paymentBillId, amount, method: paymentMethod }); }} disabled={payMut.isPending}>Save payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
