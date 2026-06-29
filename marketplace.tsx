import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, MapPin, Thermometer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, timeLeft, STATUS_STYLES } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace — FreshBid" }] }),
  component: Marketplace,
});

function Marketplace() {
  const [lots, setLots] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [zoneFilter, setZoneFilter] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let query = supabase.from("surplus_lots").select("*").in("status", ["open", "closing"]).order("closes_at");
    if (zoneFilter !== "all") query = query.eq("zone_id", zoneFilter);
    const { data } = await query;
    setLots(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.from("zones").select("*").then(({ data }) => setZones(data ?? []));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [zoneFilter]);

  const filtered = lots.filter((l) => l.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Surplus marketplace</h1>
        <p className="text-muted-foreground">Bid on live surplus lots. Browsing is limited to your permitted zones.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lots…" className="pl-9" />
        </div>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All zones</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name} · {z.city}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-muted-foreground">
          No open lots match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Link key={l.id} to="/lot/$lotId" params={{ lotId: l.id }}
              className="group flex flex-col rounded-2xl border bg-card p-5 transition-all hover:border-primary hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">{l.category}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[l.status])}>{l.status}</span>
              </div>
              <h3 className="mt-3 font-bold leading-snug group-hover:text-primary">{l.title}</h3>
              <p className="text-sm text-muted-foreground">{l.quantity} {l.unit}</p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> {l.temp_sensitivity}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> closes {timeLeft(l.closes_at)}</span>
                {l.allow_partial && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> partial ok</span>}
              </div>

              <div className="mt-4 flex items-end justify-between border-t pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Current bid</p>
                  <p className="text-lg font-extrabold">{money(l.current_price || l.reserve_price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Reserve</p>
                  <p className="text-sm font-semibold">{money(l.reserve_price)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
