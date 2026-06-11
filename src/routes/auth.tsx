import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export default function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        toast.success("Welcome back");
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in");
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm bg-card border rounded-2xl p-6 shadow-[var(--shadow-soft)]">
        <div className="text-center mb-2">
          <p className="text-xs text-muted-foreground mb-4">v1.0 · Single Admin Mode</p>
          <div className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold mb-2" style={{ background: "var(--gradient-warm)", color: "oklch(0.2 0.05 35)" }}>
            HI
          </div>
          <h1 className="text-xl font-bold">Hotel Inimai</h1>
          <p className="text-sm text-muted-foreground">{mode === "login" ? "Sign in to manage your hotel" : "Create the admin account"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>No account yet? <button className="text-primary font-medium hover:underline" onClick={() => setMode("signup")}>Create one</button></>
          ) : (
            <>Already have an account? <button className="text-primary font-medium hover:underline" onClick={() => setMode("login")}>Sign in</button></>
          )}
        </div>
        <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
          Powered by Redra Tech
        </div>
      </div>
    </div>
  );
}