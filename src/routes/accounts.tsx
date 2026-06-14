import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, ShoppingBag, Trash2, Minus, Plus as PlusIcon, Wallet, Eye, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  createAccountHolder,
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

interface DraftHolder {
  name: string;
  phone: string;
  description: string;
}

type CartLineUI = CartLine & { key: string };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { holderId } = useParams<{ holderId?: string }>();
  const { data: items = [], isLoading } = useQuery(itemsQuery);
  const { data: holders = [], refetch: refetchHolders } = useQuery({ queryKey: ["account_holders"], queryFn: fetchAccountHolders });
  const { data: allBills = [] } = useQuery({ queryKey: ["account_holder_bills_all"], queryFn: fetchAllAccountHolderBills });
  const [holderSearch, setHolderSearch] = useState("");
  const [selectedHolderId, setSelectedHolderId] = useState<string | null>(holderId ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftHolder>({ name: "", phone: "", description: "" });
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

  useEffect(() => {
    if (holderId) {
      setSelectedHolderId(holderId);
    }
  }, [holderId]);

  const { data: bills = [] } = useQuery({
    queryKey: ["account_holder_bills", selectedHolderId],
    queryFn: () => fetchAccountHolderBills(selectedHolderId!),
    enabled: !!selectedHolderId,
  });
  const selectedHolder = holders.find((h) => h.id === selectedHolderId) ?? null;
  const activeBill = bills.find((bill) => bill.id === activeBillId) ?? null;

  const filteredHolders = useMemo(() => holders.filter((h) => {
    const q = holderSearch.toLowerCase();
    return !q || h.name.toLowerCase().includes(q) || (h.phone ?? "").toLowerCase().includes(q);
  }), [holders, holderSearch]);

  const filteredItems = useMemo(() => items.filter((item) => item.status === "active"), [items]);
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const totalOutstanding = bills.reduce((sum, bill) => sum + Number(bill.balance_amount ?? 0), 0);

  const { data: activeItems = [] } = useQuery({
    queryKey: ["account_holder_bill_items", activeBill?.id],
    queryFn: () => fetchAccountHolderBillItems(activeBill!.id),
    enabled: !!activeBill,
  });

  function openPicker(item: MenuItem) {
    setPicker(item);
    setPickQty("1");
  }

  function confirmPicker() {
    if (!picker) return;
    const qty = Math.max(1, Number.parseInt(pickQty, 10) || 1);
    const key = picker.id;
    setCart((existing) => {
      const found = existing.find((line) => line.key === key);
      if (found) return existing.map((line) => line.key === key ? { ...line, quantity: line.quantity + qty } : line);
      return [...existing, { key, item_id: picker.id, item_name: picker.name, price: Number(picker.price), quantity: qty }];
    });
    setPicker(null);
  }

  function changeQty(key: string, amount: number) {
    setCart((existing) => existing.map((line) => line.key === key ? { ...line, quantity: Math.max(0, line.quantity + amount) } : line).filter((line) => line.quantity > 0));
  }

  function removeLine(key: string) {
    setCart((existing) => existing.filter((line) => line.key !== key));
  }

  const createHolderMut = useMutation({
    mutationFn: createAccountHolder,
    onSuccess: async () => {
      toast.success("Account holder created");
      setDraft({ name: "", phone: "", description: "" });
      setCreateOpen(false);
      await refetchHolders();
    },
    onError: (error: any) => toast.error(error?.message ?? "Failed to create account holder"),
  });

  const createBillMut = useMutation({
    mutationFn: () => createAccountHolderBill(selectedHolderId!, cart.map(({ key, ...line }) => line)),
    onSuccess: async () => {
      toast.success("Account bill created");
      setCart([]);
      await qc.invalidateQueries({ queryKey: ["account_holder_bills", selectedHolderId] });
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
      await qc.invalidateQueries({ queryKey: ["account_holder_bills", selectedHolderId] });
      await qc.invalidateQueries({ queryKey: ["account_holders"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Failed to record payment"),
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Account Holders</h1>
        <p className="text-muted-foreground">Create account holders, generate account bills, and track balance payments from one place.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-4">
          <div className="bg-card rounded-2xl border p-4 shadow-[var(--shadow-soft)] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Account Holders</h2>
                <p className="text-xs text-muted-foreground">Tap a holder to create bills and view history.</p>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" />New</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={holderSearch} onChange={(e) => setHolderSearch(e.target.value)} placeholder="Search name or phone" className="pl-9 bg-background" />
            </div>
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {filteredHolders.map((holder) => {
                const unpaid = allBills.filter((bill) => bill.account_holder_id === holder.id).reduce((sum, bill) => sum + Number(bill.balance_amount ?? 0), 0);
                const active = selectedHolderId === holder.id;
                return (
                  <button
                    key={holder.id}
                    onClick={() => {
                      setSelectedHolderId(holder.id);
                      navigate(`/accounts/${slugify(holder.name)}/${holder.id}`);
                    }}
                    className={cn("w-full rounded-xl border p-4 text-left transition-colors", active ? "border-primary bg-primary/5" : "hover:bg-muted/40")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{holder.name}</div>
                        <div className="text-xs text-muted-foreground">{holder.phone || "No phone"}</div>
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{formatINR(unpaid)}</span>
                    </div>
                    {holder.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{holder.description}</p>}
                  </button>
                );
              })}
              {!filteredHolders.length && <div className="text-sm text-muted-foreground py-8 text-center">No account holders found.</div>}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {!selectedHolder ? (
            <div className="bg-card rounded-2xl border p-6 shadow-[var(--shadow-soft)] space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-primary">Account holders</p>
                <h2 className="text-xl font-semibold">Create a holder to start billing</h2>
                <p className="text-sm text-muted-foreground">Use the New button on the left to add the first account holder and begin tracking bills.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredHolders.slice(0, 3).map((holder) => {
                  const unpaid = allBills.filter((bill) => bill.account_holder_id === holder.id).reduce((sum, bill) => sum + Number(bill.balance_amount ?? 0), 0);
                  return (
                    <article key={holder.id} className="rounded-2xl border bg-background p-4">
                      <div className="text-sm font-semibold">{holder.name}</div>
                      <div className="text-xs text-muted-foreground">{holder.phone || "No phone"}</div>
                      <div className="mt-3 text-xs text-primary">Outstanding {formatINR(unpaid)}</div>
                    </article>
                  );
                })}
                {!filteredHolders.length && <div className="text-sm text-muted-foreground">No account holders yet. Click New to create one.</div>}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)] space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-primary">Selected holder</p>
                      <h2 className="text-xl font-semibold">{selectedHolder.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedHolder.phone || "No phone"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="rounded-2xl bg-primary/10 px-4 py-3 text-right">
                        <div className="text-[11px] uppercase text-primary/80">Outstanding</div>
                        <div className="text-xl font-bold text-primary">{formatINR(totalOutstanding)}</div>
                      </div>
                      <Button size="sm" onClick={() => setHistoryOpen(true)} className="gap-1">Bill History</Button>
                    </div>
                  </div>
                  {selectedHolder.description && <p className="text-sm text-muted-foreground">{selectedHolder.description}</p>}
                </div>

                <div className="bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-primary" />Balance Summary</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-muted/50 p-3"><div className="text-muted-foreground">Bills</div><div className="text-xl font-bold">{bills.length}</div></div>
                    <div className="rounded-xl bg-muted/50 p-3"><div className="text-muted-foreground">Pending</div><div className="text-xl font-bold">{formatINR(totalOutstanding)}</div></div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
                <div className="bg-card rounded-2xl border p-4 shadow-[var(--shadow-soft)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Create account bill</h3>
                      <p className="text-xs text-muted-foreground">Choose menu items and save them under this holder.</p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs">{cartCount} items</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

                <aside className="hidden xl:flex xl:w-[400px] border-l flex-col rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-primary" />Current Account Bill</div>
                  <div className="max-h-[360px] overflow-auto space-y-2 pr-1">
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

              <div className="bg-card rounded-2xl border p-4 shadow-[var(--shadow-soft)] text-sm text-muted-foreground">
                Click the <span className="font-semibold text-foreground">Bill History</span> button above to open all bills for this holder in a popup.
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create account holder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Account holder name" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Notes / reference" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createHolderMut.mutate(draft)} disabled={createHolderMut.isPending || !draft.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!picker} onOpenChange={(open) => !open && setPicker(null)}>
        <DialogContent>
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
                <Input type="number" min={1} value={pickQty} onChange={(e) => setPickQty(e.target.value)} className="w-20 text-center" />
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bill History · {selectedHolder?.name ?? "Account Holder"}</DialogTitle>
          </DialogHeader>
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
        <DialogContent className="max-w-md">
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
        <DialogContent>
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
                  <button key={method} onClick={() => setPaymentMethod(method)} className={cn("rounded-xl border px-3 py-2 text-sm capitalize", paymentMethod === method ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                    {method.replace('_', ' ')}
                  </button>
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
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden fixed bottom-4 inset-x-4 z-30 h-14 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] flex items-center justify-between px-5 active:scale-[0.98] transition-transform" aria-label="Open account bill">
            <div className="flex items-center gap-2">
              <div className="relative"><ShoppingCart className="h-5 w-5" />{cartCount > 0 && <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">{cartCount}</span>}</div>
              <span className="font-semibold">View Account Bill</span>
            </div>
            <span className="font-bold text-lg">{formatINR(total)}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="p-0 h-[88vh] rounded-t-2xl flex flex-col">
          {cartPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
