import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DEFAULT_FOOD_IMAGE, itemsQuery, formatINR, thumbUrl, type MenuItem } from "@/lib/db";

type Draft = {
  id?: string;
  name: string;
  category: string;
  price: string;
  image_url: string;
  description: string;
  status: string;
};

const empty: Draft = { name: "", category: "Breakfast", price: "", image_url: "", description: "", status: "active" };

export default function MenuPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(itemsQuery);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [filter, setFilter] = useState("All");

  function openNew() { setDraft(empty); setOpen(true); }
  function openEdit(it: MenuItem) {
    setDraft({ id: it.id, name: it.name, category: it.category, price: String(it.price), image_url: it.image_url ?? "", description: it.description ?? "", status: it.status });
    setOpen(true);
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data, error: signErr } = await supabase.storage.from("menu-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;
      setDraft((d) => ({ ...d, image_url: data.signedUrl }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: draft.name.trim(),
        category: draft.category,
        price: Number(draft.price) || 0,
        image_url: draft.image_url.trim() || null,
        description: draft.description.trim() || null,
        status: draft.status,
      };
      if (!payload.name) throw new Error("Name is required");
      if (draft.id) {
        const { error } = await supabase.from("items").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["items"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["items"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (it: MenuItem) => {
      const { error } = await supabase.from("items").update({ status: it.status === "active" ? "disabled" : "active" }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const filtered = items.filter((i) => filter === "All" ? true : i.category === filter);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground">Add, edit, disable or remove items.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add Item</Button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${filter === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>{c}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <div key={it.id} className="bg-card rounded-2xl border overflow-hidden shadow-[var(--shadow-soft)]">
              <div className="aspect-video bg-muted">
                <img src={thumbUrl(it.image_url, 480)} alt={it.name} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_IMAGE)} />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.category}</div>
                  </div>
                  <Badge variant={it.status === "active" ? "default" : "secondary"}>{it.status}</Badge>
                </div>
                <div className="mt-2 font-bold text-primary text-lg">{formatINR(Number(it.price))}</div>
                {it.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.description}</div>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(it)} className="flex-1"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => toggle.mutate(it)} title="Toggle status"><Power className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this item?")) del.mutate(it.id); }} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">No items.</div>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Edit Item" : "Add Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Image preview</Label>
              <div className="mt-1 aspect-video bg-muted rounded-lg overflow-hidden border">
                <img src={draft.image_url || DEFAULT_FOOD_IMAGE} alt="" className="w-full h-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_IMAGE)} />
              </div>
            </div>
            <div>
              <Label>Dish image</Label>
              <div className="flex gap-2 mt-1">
                <Input value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="Paste image URL or upload below" />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2 shrink-0">
                  <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {draft.image_url && (
                <button type="button" onClick={() => setDraft({ ...draft, image_url: "" })} className="text-xs text-muted-foreground hover:text-destructive mt-1">Remove image</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}