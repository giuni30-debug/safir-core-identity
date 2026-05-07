-- 1. Roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. RLS for user_roles (admin only)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Affiliate settings table
CREATE TABLE public.affiliate_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  url text NOT NULL,
  icon text,
  accent_color text NOT NULL DEFAULT 'oklch(0.70 0.18 250)',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view enabled affiliates"
  ON public.affiliate_settings FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert affiliates"
  ON public.affiliate_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update affiliates"
  ON public.affiliate_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete affiliates"
  ON public.affiliate_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER affiliate_settings_updated_at
  BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Seed default networks
INSERT INTO public.affiliate_settings (network, label, description, url, icon, accent_color, sort_order) VALUES
  ('booking', 'Booking.com', 'Hotels & stays worldwide', 'https://www.booking.com/', '🏨', 'oklch(0.70 0.18 250)', 1),
  ('amazon', 'Amazon', 'Shopping & essentials', 'https://www.amazon.com/', '📦', 'oklch(0.78 0.16 60)', 2),
  ('modanisa', 'Modanisa', 'Modest fashion & lifestyle', 'https://www.modanisa.com/', '👗', 'oklch(0.72 0.17 320)', 3),
  ('agoda', 'Agoda', 'Travel deals & hotels', 'https://www.agoda.com/', '✈️', 'oklch(0.78 0.16 200)', 4),
  ('safetywing', 'SafetyWing', 'Travel insurance', 'https://safetywing.com/', '🛡️', 'oklch(0.78 0.18 145)', 5);

-- 6. Grant admin role to specified emails
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email IN ('giuni86@gmail.com', 'safirtraslate86@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;