
-- ====== ENUMS ======
CREATE TYPE public.app_role AS ENUM ('admin', 'supplier', 'buyer', 'logistics');
CREATE TYPE public.lot_status AS ENUM ('draft', 'open', 'closing', 'awarded', 'completed', 'failed', 'cancelled');
CREATE TYPE public.bid_status AS ENUM ('active', 'outbid', 'won', 'lost', 'withdrawn');
CREATE TYPE public.food_category AS ENUM ('bakery','produce','dairy','prepared','meat','frozen','pantry','beverage','other');
CREATE TYPE public.temp_sensitivity AS ENUM ('ambient','chilled','frozen','hot');

-- ====== UPDATED_AT HELPER ======
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- ====== ZONES ======
CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.zones TO authenticated, anon;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Zones are viewable by everyone" ON public.zones FOR SELECT USING (true);

-- ====== PROFILES ======
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  org_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'buyer',
  zone_id UUID REFERENCES public.zones(id),
  trust_score NUMERIC NOT NULL DEFAULT 75,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== USER ROLES ======
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ====== AUTO PROFILE + DEFAULT ROLE ON SIGNUP ======
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, org_name, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'org_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'buyer')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, (COALESCE(NEW.raw_user_meta_data->>'account_type', 'buyer'))::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====== CHARITIES ======
CREATE TABLE public.charities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  registration_no TEXT,
  zone_id UUID REFERENCES public.zones(id),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.charities TO authenticated;
GRANT ALL ON public.charities TO service_role;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verified charities viewable" ON public.charities FOR SELECT TO authenticated USING (verified = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage charities" ON public.charities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ====== SURPLUS LOTS ======
CREATE TABLE public.surplus_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id),
  title TEXT NOT NULL,
  category public.food_category NOT NULL DEFAULT 'other',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'kg',
  total_inventory NUMERIC,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  packaging TEXT,
  temp_sensitivity public.temp_sensitivity NOT NULL DEFAULT 'ambient',
  expiry_at TIMESTAMPTZ NOT NULL,
  pickup_start TIMESTAMPTZ NOT NULL,
  pickup_end TIMESTAMPTZ NOT NULL,
  reserve_price NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0,
  predicted_surplus NUMERIC,
  predicted_value NUMERIC,
  pickup_success_prob NUMERIC,
  allow_partial BOOLEAN NOT NULL DEFAULT false,
  status public.lot_status NOT NULL DEFAULT 'open',
  closes_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '6 hours',
  winning_bid_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surplus_lots TO authenticated;
GRANT ALL ON public.surplus_lots TO service_role;
ALTER TABLE public.surplus_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lots viewable by authenticated" ON public.surplus_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers create own lots" ON public.surplus_lots FOR INSERT TO authenticated WITH CHECK (auth.uid() = supplier_id);
CREATE POLICY "Suppliers update own lots" ON public.surplus_lots FOR UPDATE TO authenticated USING (auth.uid() = supplier_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = supplier_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Suppliers delete own lots" ON public.surplus_lots FOR DELETE TO authenticated USING (auth.uid() = supplier_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lots_updated BEFORE UPDATE ON public.surplus_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== BIDS ======
CREATE TABLE public.bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES public.surplus_lots(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charity_id UUID REFERENCES public.charities(id),
  amount NUMERIC NOT NULL,
  quantity_requested NUMERIC,
  pickup_reliability NUMERIC NOT NULL DEFAULT 80,
  effective_score NUMERIC,
  status public.bid_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
-- Buyers see their own bids; the lot supplier sees bids on their lots; admins see all.
CREATE POLICY "Bid visibility" ON public.bids FOR SELECT TO authenticated USING (
  auth.uid() = buyer_id
  OR public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.surplus_lots l WHERE l.id = lot_id AND l.supplier_id = auth.uid())
);
CREATE POLICY "Buyers create own bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers update own bids" ON public.bids FOR UPDATE TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

-- ====== DONATIONS ======
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES public.surplus_lots(id) ON DELETE SET NULL,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charity_id UUID REFERENCES public.charities(id),
  amount NUMERIC NOT NULL,
  credited_in_name_of TEXT,
  meals_estimated INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donation visibility" ON public.donations FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Buyers create own donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

-- ====== AUDIT LOGS ======
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own audit entries" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "Audit visible to actor or admin" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = actor_id OR public.has_role(auth.uid(),'admin'));

-- ====== SEED ZONES & CHARITIES ======
INSERT INTO public.zones (name, city, center_lat, center_lng, radius_km) VALUES
  ('Downtown Core','Metro City',40.7128,-74.0060,12),
  ('North District','Metro City',40.8200,-73.9500,15),
  ('Harbor West','Metro City',40.6500,-74.0500,18);

INSERT INTO public.charities (name, description, registration_no, verified) VALUES
  ('City Food Bank','Largest hunger-relief network in the metro area.','CH-100231',true),
  ('Meals Together','Hot meals for families in need.','CH-220984',true),
  ('Harvest Share','Redistributes fresh produce to shelters.','CH-553120',true);
