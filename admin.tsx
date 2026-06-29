import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ScrollText, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { fraudRisk } from "@/lib/predict";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — FreshBid" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!data);
      const [{ data: l }, { data: lt }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("surplus_lots").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      setLogs(l ?? []);
      setLots(lt ?? []);
    })();
  }, [user]);

  if (isAdmin === false) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Admin</h1>
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Admin access required</p>
          <p className="text-sm text-muted-foreground">Role-based access control restricts this dashboard to platform admins. Your own audit trail is shown below.</p>
        </div>
        <AuditTable logs={logs} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-extrabold tracking-tight">Admin dashboard</h1>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><AlertTriangle className="h-5 w-5 text-warning-foreground" /> Lot oversight & risk</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Lot</th><th className="p-3">Status</th><th className="p-3">Reserve</th><th className="p-3">Current</th><th className="p-3">Risk</th></tr>
            </thead>
            <tbody>
              {lots.map((l) => {
                const ratio = l.reserve_price ? Number(l.current_price) / Number(l.reserve_price) : 1;
                const risk = fraudRisk({ buyerTrust: 70, bidVsReserveRatio: ratio, accountAgeDays: 30, recentBidCount: 5 });
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 font-medium">{l.title}</td>
                    <td className="p-3 capitalize">{l.status}</td>
                    <td className="p-3">${Number(l.reserve_price).toFixed(2)}</td>
                    <td className="p-3">${Number(l.current_price).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold",
                        risk > 50 ? "bg-destructive/15 text-destructive" : risk > 25 ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success")}>
                        {risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AuditTable logs={logs} />
    </div>
  );
}

function AuditTable({ logs }: { logs: any[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><ScrollText className="h-5 w-5" /> Audit trail</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">When</th></tr>
            </thead>
            <tbody>
              {logs.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="p-3 font-medium">{g.action}</td>
                  <td className="p-3 text-muted-foreground">{g.entity ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(g.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
