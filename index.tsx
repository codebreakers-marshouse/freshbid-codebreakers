import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Gavel, HeartHandshake, ShieldCheck, ArrowRight, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { money, timeLeft, STATUS_STYLES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({ openLots: 0, myBids: 0, donations: 0, meals: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: openLots }, { count: myBids }, { data: donations }, { data: lots }] = await Promise.all([
        supabase.from("surplus_lots").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("bids").select("id", { count: "exact", head: true }).eq("buyer_id", user.id),
        supabase.from("donations").select("amount, meals_estimated").eq("buyer_id", user.id),
        supabase.from("surplus_lots").select("*").eq("status", "open").order("closes_at").limit(5),
      ]);
      const totalDon = (donations ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalMeals = (donations ?? []).reduce((s, d) => s + (d.meals_estimated ?? 0), 0);
      setStats({ openLots: openLots ?? 0, myBids: myBids ?? 0, donations: totalDon, meals: totalMeals });
      setRecent(lots ?? []);
    })();
  }, [user]);

  const cards = [
    { label: "Open auctions", value: stats.openLots, icon: Store, accent: "text-primary" },
    { label: "My bids", value: stats.myBids, icon: Gavel, accent: "text-accent-foreground" },
    { label: "Donated", value: money(stats.donations), icon: HeartHandshake, accent: "text-success" },
    { label: "Meals funded", value: stats.meals, icon: Utensils, accent: "text-warning-foreground" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">Your food-rescue activity at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Trust score</span>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
            {Math.round(Number(profile?.trust_score ?? 0))}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5">
            <c.icon className={cn("h-6 w-6", c.accent)} />
            <p className="mt-4 text-2xl font-extrabold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard to="/marketplace" icon={Store} title="Browse marketplace" desc="Bid on live surplus lots in your zone." />
        <ActionCard to="/supplier" icon={Gavel} title="List surplus" desc="Predict surplus & expected value before listing." />
        <ActionCard to="/impact" icon={ShieldCheck} title="View impact" desc="See receipts and donation credits." />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Closing soon</h2>
          <Link to="/marketplace" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No open auctions yet. List surplus to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Lot</th><th className="p-3">Current</th><th className="p-3">Closes in</th><th className="p-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 font-medium">{l.title}</td>
                    <td className="p-3">{money(l.current_price || l.reserve_price)}</td>
                    <td className="p-3">{timeLeft(l.closes_at)}</td>
                    <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[l.status])}>{l.status}</span></td>
                    <td className="p-3 text-right">
                      <Link to="/lot/$lotId" params={{ lotId: l.id }}><Button size="sm" variant="ghost">Open <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, desc }: { to: string; icon: any; title: string; desc: string }) {
  return (
    <Link to={to} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <span className="mt-3 inline-flex items-center text-sm font-medium text-primary">
        Go <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
