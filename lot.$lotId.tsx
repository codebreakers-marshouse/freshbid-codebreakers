import { createFileRoute, useParams, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Clock, Thermometer, AlertTriangle, Package, Gavel, Trophy, RefreshCw, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { money, timeLeft, hoursUntil, STATUS_STYLES } from "@/lib/format";
import { effectiveBidScore, pickupSuccessProbability, estimateMeals } from "@/lib/predict";
import { awardLot, reassignLot } from "@/lib/auction.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lot/$lotId")({
  component: LotDetail,
});

const ANTISNIPE_MIN = 5;

function LotDetail() {
  const { lotId } = useParams({ from: "/_authenticated/lot/$lotId" });
  const { user, profile } = useAuth();
  const router = useRouter();
  const callAward = useServerFn(awardLot);
  const callReassign = useServerFn(reassignLot);

  const [lot, setLot] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [charities, setCharities] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [reliability, setReliability] = useState(85);
  const [charityId, setCharityId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: l }, { data: b }, { data: c }] = await Promise.all([
      supabase.from("surplus_lots").select("*").eq("id", lotId).maybeSingle(),
      supabase.from("bids").select("*").eq("lot_id", lotId).order("amount", { ascending: false }),
      supabase.from("charities").select("*").eq("verified", true),
    ]);
    setLot(l);
    setBids(b ?? []);
    setCharities(c ?? []);
    if (c && c.length && !charityId) setCharityId(c[0].id);
  }, [lotId, charityId]);

  useEffect(() => { load(); }, [load]);

  // Live updates for bids on this lot.
  useEffect(() => {
    const ch = supabase.channel(`lot-${lotId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `lot_id=eq.${lotId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "surplus_lots", filter: `id=eq.${lotId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lotId, load]);

  if (!lot) return <p className="text-muted-foreground">Loading lot…</p>;

  const isSupplier = user?.id === lot.supplier_id;
  const isOpen = lot.status === "open" || lot.status === "closing";
  const minBid = Math.max(Number(lot.reserve_price), Number(lot.current_price)) + (lot.current_price ? 0.5 : 0);
  const previewScore = amount
    ? effectiveBidScore(Number(amount), Number(lot.reserve_price), reliability, Number(profile?.trust_score ?? 50))
    : 0;
  const pickupProb = pickupSuccessProbability(reliability, Number(profile?.trust_score ?? 50), hoursUntil(lot.pickup_end) - hoursUntil(lot.pickup_start) || 2);

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (amt < minBid) { toast.error(`Bid must be at least ${money(minBid)}`); return; }
    if (!charityId) { toast.error("Select a charity for the donation credit."); return; }
    setBusy(true);
    try {
      const score = effectiveBidScore(amt, Number(lot.reserve_price), reliability, Number(profile?.trust_score ?? 50));
      const { error } = await supabase.from("bids").insert({
        lot_id: lotId, buyer_id: user.id, charity_id: charityId, amount: amt,
        pickup_reliability: reliability, effective_score: score, status: "active",
      });
      if (error) throw error;

      const updates: any = { current_price: amt };
      // Anti-sniping: extend the close time if a bid lands in the final minutes.
      if (hoursUntil(lot.closes_at) * 60 < ANTISNIPE_MIN) {
        updates.closes_at = new Date(Date.now() + ANTISNIPE_MIN * 60000).toISOString();
        toast.info("Anti-snipe: auction extended by 5 minutes.");
      }
      await supabase.from("surplus_lots").update(updates).eq("id", lotId);
      await supabase.from("audit_logs").insert({ actor_id: user.id, action: "bid_placed", entity: "surplus_lot", entity_id: lotId, meta: { amount: amt } });
      toast.success("Bid placed.");
      setAmount("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place bid");
    } finally { setBusy(false); }
  }

  async function handleAward() {
    setBusy(true);
    try {
      const res = (await callAward({ data: { lotId } })) as { amount: number };
      toast.success(`Lot awarded at ${money(res.amount)} — donation credited.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Award failed");
    } finally { setBusy(false); }
  }

  async function handleReassign() {
    setBusy(true);
    try {
      const res: any = await callReassign({ data: { lotId } });
      toast.success(res.reassigned ? "Reassigned to next-best buyer." : "No fallback bid — lot marked failed.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reassign failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <Link to="/marketplace" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to marketplace
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">{lot.category}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[lot.status])}>{lot.status}</span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold">{lot.title}</h1>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Detail icon={Package} label="Quantity" value={`${lot.quantity} ${lot.unit}`} />
              <Detail icon={Thermometer} label="Temperature" value={lot.temp_sensitivity} />
              <Detail icon={Clock} label="Closes in" value={timeLeft(lot.closes_at)} />
              <Detail icon={AlertTriangle} label="Expires" value={new Date(lot.expiry_at).toLocaleString()} />
              <Detail icon={Clock} label="Pickup" value={`${new Date(lot.pickup_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(lot.pickup_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`} />
              <Detail icon={Package} label="Packaging" value={lot.packaging || "—"} />
            </div>
            {lot.allergens?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Allergens</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lot.allergens.map((a: string) => <span key={a} className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{a}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Prediction panel */}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-bold">Predicted intelligence</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Score label="Predicted value" value={money(lot.predicted_value)} />
              <Score label="Predicted surplus" value={lot.predicted_surplus ? `${lot.predicted_surplus} ${lot.unit}` : "—"} />
              <Score label="Pickup success" value={lot.pickup_success_prob ? `${Math.round(lot.pickup_success_prob * 100)}%` : "—"} />
              <Score label="Reserve" value={money(lot.reserve_price)} />
            </div>
          </div>

          {/* Bids */}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="font-bold">Bids ({bids.length})</h2>
            {bids.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No bids yet.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="pb-2">Amount</th><th className="pb-2">Reliability</th><th className="pb-2">Eff. score</th><th className="pb-2">Status</th></tr>
                </thead>
                <tbody>
                  {bids.map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="py-2 font-semibold">{money(b.amount)}{b.buyer_id === user?.id && <span className="ml-1 text-xs text-primary">(you)</span>}</td>
                      <td className="py-2">{b.pickup_reliability}%</td>
                      <td className="py-2">{b.effective_score ?? "—"}</td>
                      <td className="py-2"><span className="capitalize">{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {(isSupplier || profile?.account_type === "admin") && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                {isOpen && bids.some((b) => b.status === "active") && (
                  <Button onClick={handleAward} disabled={busy}><Trophy className="mr-2 h-4 w-4" /> Award winner</Button>
                )}
                {lot.status === "awarded" && (
                  <Button variant="outline" onClick={handleReassign} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Winner no-show → reassign
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bid sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Current bid</p>
            <p className="text-3xl font-extrabold">{money(lot.current_price || lot.reserve_price)}</p>

            {isOpen && !isSupplier ? (
              <form onSubmit={placeBid} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Your bid (min {money(minBid)})</Label>
                  <Input id="amount" type="number" step="0.5" min={minBid} value={amount}
                    onChange={(e) => setAmount(e.target.value)} placeholder={String(minBid)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rel">Pickup reliability: {reliability}%</Label>
                  <input id="rel" type="range" min={40} max={100} value={reliability}
                    onChange={(e) => setReliability(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charity">Donation charity</Label>
                  <select id="charity" value={charityId} onChange={(e) => setCharityId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required>
                    {charities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Effective score</span><span className="font-semibold text-foreground">{previewScore || "—"}</span></div>
                  <div className="flex justify-between"><span>Pickup success</span><span className="font-semibold text-foreground">{Math.round(pickupProb * 100)}%</span></div>
                  {amount && <div className="flex justify-between"><span>Est. meals funded</span><span className="font-semibold text-foreground">{estimateMeals(Number(amount))}</span></div>}
                </div>
                <Button type="submit" className="w-full" disabled={busy}><Gavel className="mr-2 h-4 w-4" /> Place bid</Button>
                <p className="text-center text-[11px] text-muted-foreground">Winner is chosen by effective score (bid × reliability × trust), not price alone.</p>
              </form>
            ) : isSupplier ? (
              <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <ShieldAlert className="mb-1 h-4 w-4" /> This is your lot — suppliers cannot bid on their own surplus (conflict of interest).
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">This auction is {lot.status}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-0.5 font-semibold capitalize">{value}</p>
    </div>
  );
}
function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold text-primary">{value}</p>
    </div>
  );
}
