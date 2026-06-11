import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export type ItemCategory = "Breakfast" | "Lunch" | "Dinner" | "Beverages" | "Snacks";
export const CATEGORIES: ItemCategory[] = ["Breakfast", "Lunch", "Dinner", "Beverages", "Snacks"];

export const DEFAULT_FOOD_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800";

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export async function fetchItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: fetchItems,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const billsQuery = queryOptions({
  queryKey: ["bills"],
  queryFn: fetchBills,
  staleTime: 60 * 1000,
});

// Append Unsplash sizing params for smaller, faster thumbnails.
export function thumbUrl(url: string | null | undefined, w = 320): string {
  const src = url || DEFAULT_FOOD_IMAGE;
  if (!/images\.unsplash\.com/.test(src)) return src;
  const sep = src.includes("?") ? "&" : "?";
  // Strip any existing w= to avoid duplicates
  const cleaned = src.replace(/([?&])w=\d+/g, "$1").replace(/&&+/g, "&").replace(/\?&/, "?");
  return `${cleaned}${cleaned.includes("?") ? "&" : "?"}w=${w}&q=70&auto=format&fit=crop`;
}

export async function fetchBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bill[];
}

export async function fetchBillItems(billId: string): Promise<BillItem[]> {
  const { data, error } = await supabase
    .from("bill_items")
    .select("*")
    .eq("bill_id", billId);
  if (error) throw error;
  return (data ?? []) as BillItem[];
}

export async function fetchAllBillItems(): Promise<BillItem[]> {
  const { data, error } = await supabase.from("bill_items").select("*");
  if (error) throw error;
  return (data ?? []) as BillItem[];
}

export interface CartLine {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

export async function createBill(lines: CartLine[], paymentMethod: string = "cash"): Promise<Bill> {
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const { data: bill, error } = await supabase
    .from("bills")
    .insert({ total_amount: total, payment_method: paymentMethod })
    .select()
    .single();
  if (error) throw error;
  const rows = lines.map((l) => ({
    bill_id: bill!.id,
    item_id: l.item_id,
    item_name: l.item_name,
    quantity: l.quantity,
    price: l.price,
    subtotal: l.price * l.quantity,
  }));
  const { error: e2 } = await supabase.from("bill_items").insert(rows);
  if (e2) throw e2;
  return bill as Bill;
}

export const HOTEL_INFO = {
  name: "Hotel Inimai",
  address: "123 Main Street, Chennai",
  phone: "+91 98765 43210",
};

export function formatINR(n: number) {
  return "₹" + Number(n).toFixed(2);
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}