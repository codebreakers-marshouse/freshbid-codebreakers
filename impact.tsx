import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeartHandshake, Utensils, Receipt, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/impact")({
  head: () => ({ meta: [{ title: "My Impact — FreshBid" }] }),
  component: ImpactPage,
});

function ImpactPage() {
  const { user, profile } = useAuth();
  const [donations, setDonations] = useState<any[]>([]);
  const [charities, setCharities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: dons }, { data: chs }] = await Promise.all([
        supabase.from("donations").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
        supabase.from("charities").select("id, name"),
      ]);
      setDonations(dons ?? []);
      setCharities(Object.fromEntries((chs ?? []).map((c) => [c.id, c.name])));
    })();
  }, [user]);

  const total = donations.reduce((s, d) => s + Number(d.amount), 0);
  const meals = donations.reduce((s, d) => s + (d.meals_estimated ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Your impact</h1>
        <p className="text-muted-foreground">Every winning bid credits a donation in your name to a verified charity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={HeartHandshake} label="Total donated" value={money(total)} />
        <Stat icon={Utensils} label="Meals funded" value={String(meals)} />
        <Stat icon={Award} label="Wins" value={String(donations.length)} />
      </div>

      {/* Reward tier */}
      <div className="rounded-2xl border bg-primary/5 p-6">
        <p className="font-bold text-primary">Buyer rewards</p>
        <p className="text-sm text-muted-foreground">
          Consistent top buyers earn priority access and subsidies at participating charitable supermarkets.
        </p>
        <div className="mt-4">
          {(() => {
            const tier = total >= 500 ? "Gold" : total >= 150 ? "Silver" : "Bronze";
            const next = tier === "Bronze" ? 150 : tier === "Silver" ? 500 : null;
            const pct = next ? Math.min(100, (total / next) * 100) : 100;
            return (
              <>
                <div className="flex items-center justify-between text-sm"><span className="font-semibold">{tier} tier</span>{next && <span className="text-muted-foreground">{money(total)} / {money(next)}</span>}</div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1 text-xs text-muted-foreground">Trust score {Math.round(Number(profile?.trust_score ?? 0))} · higher trust improves your effective bid score.</p>
              </>
            );
          })()}
        </div>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Receipt className="h-5 w-5" /> Donation receipts</h2>
        {donations.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
            No donations yet. Win an auction to credit your first donation.
          </div>
        ) : (
          <div className="space-y-3">
            {donations.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5">
                <div>
                  <p className="font-bold">{money(d.amount)} to {charities[d.charity_id] ?? "verified charity"}</p>
                  <p className="text-sm text-muted-foreground">Credited in name of {d.credited_in_name_of} · {new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-success">{d.meals_estimated} meals</p>
                  <p className="text-xs text-muted-foreground">Receipt #{d.id.slice(0, 8)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
