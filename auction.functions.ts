import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveBidScore, estimateMeals } from "./predict";

/** Pick the winning bid by effective score and finalize the lot atomically. */
export const awardLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: lot, error: lotErr } = await supabase
      .from("surplus_lots").select("*").eq("id", data.lotId).maybeSingle();
    if (lotErr || !lot) throw new Error("Lot not found");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (lot.supplier_id !== userId && !isAdmin) throw new Error("Not authorized to award this lot");
    if (lot.status === "awarded" || lot.status === "completed") throw new Error("Lot already awarded");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: bids } = await supabaseAdmin
      .from("bids").select("*").eq("lot_id", data.lotId).eq("status", "active");
    if (!bids || bids.length === 0) throw new Error("No active bids to award");

    // Load buyer trust scores in one query.
    const buyerIds = [...new Set(bids.map((b) => b.buyer_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, trust_score, full_name").in("id", buyerIds);
    const trustOf = new Map((profiles ?? []).map((p) => [p.id, Number(p.trust_score)]));
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string | null]));

    const scored = bids.map((b) => ({
      bid: b,
      score: effectiveBidScore(
        Number(b.amount), Number(lot.reserve_price),
        Number(b.pickup_reliability), trustOf.get(b.buyer_id) ?? 50,
      ),
    })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

    if (scored.length === 0) throw new Error("No valid bids above reserve");
    const winner = scored[0].bid;

    await supabaseAdmin.from("surplus_lots").update({
      status: "awarded", winning_bid_id: winner.id, current_price: Number(winner.amount),
    }).eq("id", lot.id);

    await supabaseAdmin.from("bids").update({ status: "won", effective_score: scored[0].score }).eq("id", winner.id);
    const loserIds = scored.slice(1).map((s) => s.bid.id);
    if (loserIds.length) await supabaseAdmin.from("bids").update({ status: "lost" }).in("id", loserIds);

    const donation = {
      bid_id: winner.id, lot_id: lot.id, buyer_id: winner.buyer_id, charity_id: winner.charity_id,
      amount: Number(winner.amount), credited_in_name_of: nameOf.get(winner.buyer_id) ?? "FreshBid Buyer",
      meals_estimated: estimateMeals(Number(winner.amount)),
    };
    const { data: donRow } = await supabaseAdmin.from("donations").insert(donation).select().maybeSingle();

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId, action: "lot_awarded", entity: "surplus_lot", entity_id: lot.id,
      meta: { winning_bid: winner.id, amount: winner.amount, effective_score: scored[0].score },
    });

    return { winnerBidId: winner.id, amount: Number(winner.amount), donation: donRow };
  });

/** Fallback reassignment when a winner fails to complete pickup. */
export const reassignLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lot } = await supabase.from("surplus_lots").select("*").eq("id", data.lotId).maybeSingle();
    if (!lot) throw new Error("Lot not found");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (lot.supplier_id !== userId && !isAdmin) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Mark the failed winner and penalize their trust slightly.
    if (lot.winning_bid_id) {
      await supabaseAdmin.from("bids").update({ status: "withdrawn" }).eq("id", lot.winning_bid_id);
      const { data: failedBid } = await supabaseAdmin.from("bids").select("buyer_id").eq("id", lot.winning_bid_id).maybeSingle();
      if (failedBid) {
        const { data: prof } = await supabaseAdmin.from("profiles").select("trust_score").eq("id", failedBid.buyer_id).maybeSingle();
        const newTrust = Math.max(0, Number(prof?.trust_score ?? 75) - 15);
        await supabaseAdmin.from("profiles").update({ trust_score: newTrust }).eq("id", failedBid.buyer_id);
      }
    }

    // Next-best candidate among lost bids.
    const { data: candidates } = await supabaseAdmin
      .from("bids").select("*").eq("lot_id", lot.id).eq("status", "lost").order("effective_score", { ascending: false });
    const next = candidates?.[0];

    if (!next) {
      await supabaseAdmin.from("surplus_lots").update({ status: "failed", winning_bid_id: null }).eq("id", lot.id);
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId, action: "lot_failed_no_fallback", entity: "surplus_lot", entity_id: lot.id, meta: {},
      });
      return { reassigned: false };
    }

    await supabaseAdmin.from("bids").update({ status: "won" }).eq("id", next.id);
    await supabaseAdmin.from("surplus_lots").update({
      status: "awarded", winning_bid_id: next.id, current_price: Number(next.amount),
    }).eq("id", lot.id);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId, action: "lot_reassigned", entity: "surplus_lot", entity_id: lot.id, meta: { new_winner: next.id },
    });
    return { reassigned: true, winnerBidId: next.id };
  });
