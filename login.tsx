import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/demo.functions";
import { DEMO_EMAIL, DEMO_PASSWORD, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — FreshBid" },
      { name: "description", content: "Sign in to FreshBid to list surplus food, bid in rescue auctions, and credit donations to verified charities." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState("buyer");
  const [busy, setBusy] = useState(false);

  // If already signed in, leave the login page.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/", replace: true });
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, account_type: accountType },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin() {
    setBusy(true);
    try {
      await ensureDemoUser();
      const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      if (error) throw error;
      router.navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-xl font-extrabold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Leaf className="h-6 w-6" />
          </span>
          {APP_NAME}
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">Rescue surplus food. Fund real meals.</h1>
          <p className="max-w-md text-primary-foreground/80">{APP_TAGLINE}. Suppliers list end-of-day surplus, charitable buyers bid, and every win credits a donation to a verified hunger-relief charity.</p>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li>• Fair, auditable, quality-weighted auctions</li>
            <li>• Surplus & price prediction before you list</li>
            <li>• Zone-aware routing and donation crediting</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} {APP_NAME}</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 lg:hidden">
            <div className="flex items-center gap-2 text-xl font-extrabold">
              <Leaf className="h-6 w-6 text-primary" /> {APP_NAME}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to continue to FreshBid." : "Join FreshBid as a supplier or charitable buyer."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account type</Label>
                  <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="buyer">Charitable buyer / donor</option>
                    <option value="supplier">Food supplier</option>
                    <option value="logistics">Logistics partner</option>
                  </select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* DEV / TESTING ONLY */}
          <div className="rounded-lg border border-dashed border-warning/60 bg-warning/10 p-3">
            <Button type="button" variant="outline" className="w-full" onClick={handleDemoLogin} disabled={busy}>
              <FlaskConical className="mr-2 h-4 w-4" /> Demo Login
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              For development & testing only — signs in as the demo account.
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account? " : "Already registered? "}
            <button type="button" className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
