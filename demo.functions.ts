import { createServerFn } from "@tanstack/react-start";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./constants";

/**
 * Idempotently provisions the demo account as a CONFIRMED user so the
 * "Demo Login" button works without email verification.
 * DEVELOPMENT / TESTING ONLY — it only ever touches the single fixed demo email.
 */
export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look for an existing demo user.
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === DEMO_EMAIL);
  if (existing) return { ok: true, created: false };

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo User", org_name: "FreshBid Demo Co.", account_type: "supplier" },
  });
  if (error && !/already/i.test(error.message)) {
    throw new Error(error.message);
  }
  return { ok: true, created: true };
});
