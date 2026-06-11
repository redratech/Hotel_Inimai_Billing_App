import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Printer, Save, Eraser, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  DEFAULT_FOOD_IMAGE,
  itemsQuery,
  formatINR,
  createBill,
  thumbUrl,
  type CartLine,
  type MenuItem,
} from "@/lib/db";
import { PrintBill, printBill } from "@/components/PrintBill";

type CartLineUI = CartLine & { key: string };

export default function POSPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(itemsQuery);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartLineUI[]>([]);
  const [lastBill, setLastBill] = useState<{ bill_number: string; created_at: string; lines: CartLine[]; total: number } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [picker, setPicker] = useState<MenuItem | null>(null);
  const [pickQty, setPickQty] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAction, setPaymentAction] = useState<"save" | "print" | null>(null);

  const filtered = useMemo(() => {
    return items
      .filter((i) => i.status === "active")
      .filter((i) => (category === "All" ? true : i.category === category))
      .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [items, category, search]);

  const total = cart.reduce((s, l) => s + l.price * l.quantity, 0);

  function openPicker(it: MenuItem) {
    setPicker(it);
    setPickQty("");
  }
  function confirmPicker() {
    if (!picker) return;
    const qty = pickQty === "" ? 1 : Math.max(1, parseInt(pickQty) || 1);
    const it = picker;
    const name = it.name;
    const key = it.id;
    setCart((c) => {
      const found = c.find((l) => l.key === key);
      if (found) return c.map((l) => (l.key === key ? { ...l, quantity: l.quantity + qty } : l));
      return [...c, { key, item_id: it.id, item_name: name, price: Number(it.price), quantity: qty }];
    });
    setPicker(null);
  }
  function changeQty(key: string, d: number) {
    setCart((c) =>
      c
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + d } : l))
        .filter((l) => l.quantity > 0)
    );
  }
  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key));
  }

  const saveMut = useMutation({
    mutationFn: (method: string) => createBill(cart.map(({ key, ...l }) => l), method),
    onSuccess: (b) => {
      toast.success(`Bill ${b.bill_number} saved`);
      setLastBill({ bill_number: b.bill_number, created_at: b.created_at, lines: cart, total });
      setCart([]);
      setCartOpen(false);
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save bill"),
  });

  async function handleSave() {
    if (!cart.length) return toast.error("Cart is empty");
    setPaymentAction("save");
    setPaymentDialogOpen(true);
  }

  async function handlePrint() {
    if (!cart.length && !lastBill) return toast.error("Nothing to print");
    if (cart.length) {
      setPaymentAction("print");
      setPaymentDialogOpen(true);
    } else {
      printBill();
    }
  }

  async function confirmPayment() {
    if (paymentAction === "save") {
      await saveMut.mutateAsync(paymentMethod);
    } else if (paymentAction === "print") {
      const b = await saveMut.mutateAsync(paymentMethod);
      setTimeout(() => printBill(), 200);
      void b;
    }
    setPaymentDialogOpen(false);
    setPaymentAction(null);
  }

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);

  const cartPanel = (
    <div className="flex flex-col h-full bg-card">
      <div className="px-5 py-4 border-b flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <div className="font-bold text-lg">Current Bill</div>
        <Badge variant="secondary" className="ml-auto">{cart.length} items</Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Tap food items to start a bill
            </div>
          )}
          {cart.map((l) => (
            <div key={l.key} className="bg-background rounded-xl p-3 border">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{l.item_name}</div>
                  <div className="text-xs text-muted-foreground">{formatINR(l.price)} × {l.quantity}</div>
                </div>
                <button onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(l.key, -1)} className="h-8 w-8 rounded-md border bg-card hover:bg-muted flex items-center justify-center">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-8 text-center font-medium">{l.quantity}</div>
                  <button onClick={() => changeQty(l.key, 1)} className="h-8 w-8 rounded-md border bg-card hover:bg-muted flex items-center justify-center">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="font-bold">{formatINR(l.price * l.quantity)}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t space-y-3 bg-card">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Items</span>
          <span>{cartCount}</span>
        </div>
        <div className="flex items-center justify-between text-2xl font-bold">
          <span>Total</span>
          <span className="text-primary">{formatINR(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => setCart([])} disabled={!cart.length}>
            <Eraser className="h-4 w-4 mr-1" /> Clear
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={!cart.length || saveMut.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button onClick={handlePrint} disabled={!cart.length && !lastBill}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Left: Menu grid */}
      <section className="flex-1 min-w-0 flex flex-col p-3 sm:p-4 lg:p-6 gap-3 sm:gap-4 overflow-hidden pb-24 lg:pb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search food..."
              className="pl-9 h-11 bg-card"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                category === c
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-card text-foreground hover:bg-muted border"
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ScrollArea className="flex-1 -mx-1">
          <div className="px-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-4">
            {isLoading && (
              <div className="col-span-full text-center text-muted-foreground py-12">Loading menu…</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">No items found</div>
            )}
            {filtered.map((it) => (
              <button
                key={it.id}
                onClick={() => openPicker(it)}
                className="group bg-card rounded-2xl overflow-hidden text-left border hover:shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  <img
                    src={thumbUrl(it.image_url, 320)}
                    alt={it.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_IMAGE)}
                  />
                </div>
                <div className="p-2.5 sm:p-3">
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{it.category}</div>
                  <div className="font-semibold truncate text-sm sm:text-base">{it.name}</div>
                  <div className="mt-0.5 sm:mt-1 font-bold text-primary text-sm sm:text-base">{formatINR(Number(it.price))}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </section>

      {/* Desktop cart */}
      <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] border-l flex-col">
        {cartPanel}
      </aside>

      {/* Mobile floating cart button + drawer */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTrigger asChild>
          <button
            className="lg:hidden no-print fixed bottom-4 inset-x-4 z-30 h-14 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] flex items-center justify-between px-5 active:scale-[0.98] transition-transform"
            aria-label="Open cart"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="font-semibold">View Bill</span>
            </div>
            <span className="font-bold text-lg">{formatINR(total)}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="p-0 h-[88vh] rounded-t-2xl flex flex-col">
          {cartPanel}
        </SheetContent>
      </Sheet>

      {lastBill && (
        <PrintBill
          billNumber={lastBill.bill_number}
          createdAt={lastBill.created_at}
          lines={lastBill.lines}
          total={lastBill.total}
        />
      )}

      {/* Item picker dialog */}
      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{picker?.name}</DialogTitle>
          </DialogHeader>
          {picker && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmPicker();
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <img
                  src={thumbUrl(picker.image_url, 160)}
                  alt={picker.name}
                  className="h-16 w-16 rounded-lg object-cover bg-muted"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_IMAGE)}
                />
                <div>
                  <div className="text-xs text-muted-foreground">{picker.category}</div>
                  <div className="font-bold text-primary text-lg">{formatINR(Number(picker.price))}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPickQty((q) => String(Math.max(1, (parseInt(q) || 0) - 1)))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={pickQty}
                    onChange={(e) => setPickQty(e.target.value)}
                    className="w-20 text-center font-bold text-lg"
                    autoFocus
                    placeholder="0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setPickQty((q) => String((parseInt(q) || 0) + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Press Enter to add to bill</p>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => setPicker(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Add · {formatINR(Number(picker.price) * (parseInt(pickQty) || 0))}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment method selection dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Total Amount: <span className="font-bold text-primary text-lg">{formatINR(total)}</span>
            </div>
            <div className="space-y-2">
              {["Cash", "Phone Pay", "Google Pay"].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method.toLowerCase().replace(" ", "_"))}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border-2 transition-colors text-left font-medium",
                    paymentMethod === method.toLowerCase().replace(" ", "_")
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
            <Button onClick={confirmPayment} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Processing…" : paymentAction === "print" ? "Save & Print" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
