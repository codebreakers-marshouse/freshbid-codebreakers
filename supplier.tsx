import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, PackagePlus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  predictSurplus, predictClearingValue, suggestReserve, pickupSuccessProbability,
  type FoodCategory, type TempSensitivity,
} from "@/lib/predict";
import { money, timeLeft, STATUS_STYLES, hoursUntil } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/supplier")({
  head: () => ({ meta: [{ title: "List Surplus — FreshBid" }] }),
  component: SupplierPage,
});

const CATEGORIES: FoodCategory[] = ["bakery", "produce", "dairy", "prepared", "meat", "frozen", "pantry", "beverage", "other"];
const TEMPS: TempSensitivity[] = ["ambient", "chilled", "frozen", "hot"];
const ALLERGENS = ["gluten", "dairy", "nuts", "eggs", "soy", "shellfish", "sesame"];

function pad(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

function SupplierPage() {
  const { user } = useAuth();
  const [zones, setZones] = useState<any[]>([]);
  const [myLots, setMyLots] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FoodCategory>("bakery");
  const [totalInventory, setTotalInventory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [temp, setTemp] = useState<TempSensitivity>("ambient");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [packaging, setPackaging] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);
  const [reserve, setReserve] = useState("");
  const [reserveTouched, setReserveTouched] = useState(false);
  const [expiry, setExpiry] = useState(pad(new Date(Date.now() + 12 * 3.6e6)));
  const [pickupStart, setPickupStart] = useState(pad(new Date(Date.now() + 2 * 3.6e6)));
  const [pickupEnd, setPickupEnd] = useState(pad(new Date(Date.now() + 5 * 3.6e6)));
  const [busy, setBusy] = useState(false);

  async function loadLots() {
    if (!user) return;
    const { data } = await supabase.from("surplus_lots").select("*").eq("supplier_id", user.id).order("created_at", { ascending: false });
    setMyLots(data ?? []);
  }
  useEffect(() => {
    supabase.from("zones").select("*").then(({ data }) => { setZones(data ?? []); if (data?.[0]) setZoneId(data[0].id); });
  }, []);
  useEffect(() => { loadLots(); /* eslint-disable-next-line */ }, [user]);

  // Live prediction layer.
  const predicted = useMemo(() => {
    const total = Number(totalInventory) || 0;
    const qty = Number(quantity) || predictSurplus(total, category);
    const hrs = hoursUntil(expiry);
    const value = predictClearingValue(qty, category, temp, hrs);
    return {
      surplus: predictSurplus(total, category),
      value,
      reserve: suggestReserve(value),
      pickupProb: pickupSuccessProbability(85, 75, 3),
    };
  }, [totalInventory, quantity, category, temp, expiry]);

  const effReserve = reserveTouched ? Number(reserve) : predicted.reserve;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const qty = Number(quantity);
    if (!title || !qty) { toast.error("Add a title and surplus quantity."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("surplus_lots").insert({
        supplier_id: user.id, zone_id: zoneId || null, title, category, quantity: qty, unit,
        total_inventory: Number(totalInventory) || null, allergens, packaging: packaging || null,
        temp_sensitivity: temp, expiry_at: new Date(expiry).toISOString(),
        pickup_start: new Date(pickupStart).toISOString(), pickup_end: new Date(pickupEnd).toISOString(),
        reserve_price: effReserve, current_price: 0, allow_partial: allowPartial,
        predicted_surplus: predicted.surplus, predicted_value: predicted.value,
        pickup_success_prob: predicted.pickupProb, status: "open",
        closes_at: new Date(Date.now() + 6 * 3.6e6).toISOString(),
      }).select().maybeSingle();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ actor_id: user.id, action: "lot_listed", entity: "surplus_lot", entity_id: data?.id, meta: { title, quantity: qty } });
      toast.success("Surplus lot listed.");
      setTitle(""); setQuantity(""); setTotalInventory(""); setReserve(""); setReserveTouched(false);
      loadLots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not list lot");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">List end-of-day surplus</h1>
        <p className="text-muted-foreground">Enter inventory and we'll predict surplus, value, and a reserve price before you list.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lot title" className="sm:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assorted day-old sourdough" required />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(v) => setCategory(v as FoodCategory)} options={CATEGORIES} />
            </Field>
            <Field label="Total daily inventory (optional)">
              <Input type="number" step="0.1" value={totalInventory} onChange={(e) => setTotalInventory(e.target.value)} placeholder="e.g. 120" />
            </Field>
            <Field label="Surplus quantity">
              <Input type="number" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={String(predicted.surplus || "")} required />
            </Field>
            <Field label="Unit">
              <Select value={unit} onChange={setUnit} options={["kg", "units", "trays", "boxes", "liters"]} />
            </Field>
            <Field label="Temperature sensitivity">
              <Select value={temp} onChange={(v) => setTemp(v as TempSensitivity)} options={TEMPS} />
            </Field>
            <Field label="Zone">
              <Select value={zoneId} onChange={setZoneId} options={zones.map((z) => ({ value: z.id, label: `${z.name} · ${z.city}` }))} />
            </Field>
            <Field label="Packaging">
              <Input value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="Boxed / loose / sealed" />
            </Field>
            <Field label="Reserve price">
              <Input type="number" step="0.5" value={reserveTouched ? reserve : predicted.reserve}
                onChange={(e) => { setReserve(e.target.value); setReserveTouched(true); }} />
            </Field>
            <Field label="Expiry" ><Input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
            <Field label="Pickup start"><Input type="datetime-local" value={pickupStart} onChange={(e) => setPickupStart(e.target.value)} /></Field>
            <Field label="Pickup end"><Input type="datetime-local" value={pickupEnd} onChange={(e) => setPickupEnd(e.target.value)} /></Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Allergens</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => (
                <button type="button" key={a} onClick={() => setAllergens((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                    allergens.includes(a) ? "border-destructive bg-destructive/10 text-destructive" : "border-input text-muted-foreground hover:bg-muted")}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} className="accent-[var(--primary)]" />
            Allow partial allocation (bidders can claim portions)
          </label>

          <Button type="submit" className="w-full" disabled={busy}><PackagePlus className="mr-2 h-4 w-4" /> List surplus lot</Button>
        </form>

        {/* Prediction sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-primary/5 p-6">
            <div className="flex items-center gap-2 font-bold text-primary"><Sparkles className="h-5 w-5" /> Prediction</div>
            <div className="mt-4 space-y-3">
              <Predict label="Predicted surplus" value={`${predicted.surplus} ${unit}`} hint="From total inventory & category" />
              <Predict label="Expected auction value" value={money(predicted.value)} hint="At current quantity & expiry" />
              <Predict label="Suggested reserve" value={money(predicted.reserve)} hint="45% of expected value" />
              <Predict label="Pickup success" value={`${Math.round(predicted.pickupProb * 100)}%`} hint="Baseline buyer reliability" />
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 text-xs text-muted-foreground">
            <TrendingUp className="mb-1 h-4 w-4 text-accent-foreground" />
            Scores update live as you adjust inputs. They feed reserve suggestions and auction prioritization — they are estimates, not guarantees.
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">Your lots</h2>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {myLots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No lots yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Lot</th><th className="p-3">Qty</th><th className="p-3">Current</th><th className="p-3">Closes</th><th className="p-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {myLots.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 font-medium">{l.title}</td>
                    <td className="p-3">{l.quantity} {l.unit}</td>
                    <td className="p-3">{money(l.current_price || l.reserve_price)}</td>
                    <td className="p-3">{timeLeft(l.closes_at)}</td>
                    <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLES[l.status])}>{l.status}</span></td>
                    <td className="p-3 text-right"><Link to="/lot/$lotId" params={{ lotId: l.id }}><Button size="sm" variant="ghost">Manage</Button></Link></td>
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-2", className)}><Label>{label}</Label>{children}</div>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize">
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function Predict({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-card p-3">
      <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="text-lg font-extrabold text-primary">{value}</span></div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
