export type AccountTransactionType = "credit" | "debit";

export interface AccountTransaction {
  id: string;
  account_id: string;
  type: AccountTransactionType;
  amount: number;
  note: string;
  created_at: string;
}

export interface AccountRecord {
  id: string;
  name: string;
  phone: string;
  opening_balance: number;
  created_at: string;
  updated_at: string;
  transactions: AccountTransaction[];
}

const STORAGE_KEY = "hotel-inimai-accounts-v1";

function safeRead(): AccountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccountRecord[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(records: AccountRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function loadAccounts(): AccountRecord[] {
  return safeRead();
}

export function createAccount(input: { name: string; phone: string; opening_balance: number }) {
  const now = new Date().toISOString();
  const record: AccountRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    opening_balance: Number(input.opening_balance) || 0,
    created_at: now,
    updated_at: now,
    transactions: [],
  };
  const records = [record, ...safeRead()];
  safeWrite(records);
  return record;
}

export function addTransaction(accountId: string, type: AccountTransactionType, amount: number, note: string) {
  const records = safeRead();
  const record = records.find((item) => item.id === accountId);
  if (!record) return null;

  const tx: AccountTransaction = {
    id: crypto.randomUUID(),
    account_id: accountId,
    type,
    amount: Number(amount) || 0,
    note: note.trim() || (type === "credit" ? "Credit added" : "Debit recorded"),
    created_at: new Date().toISOString(),
  };

  record.transactions = [tx, ...record.transactions];
  record.updated_at = tx.created_at;
  safeWrite(records);
  return tx;
}

export function getAccountBalance(record: AccountRecord) {
  const credits = record.transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + Number(t.amount), 0);
  const debits = record.transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + Number(t.amount), 0);
  return Number(record.opening_balance) + credits - debits;
}

export function getAccountSummary(record: AccountRecord) {
  return {
    balance: getAccountBalance(record),
    credits: record.transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + Number(t.amount), 0),
    debits: record.transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + Number(t.amount), 0),
  };
}
