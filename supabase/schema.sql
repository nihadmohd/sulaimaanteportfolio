-- ============================================================================
--  MOHAMMED NIHAD KP — Portfolio · Blog · Affiliate Store Platform
--  Database Schema v1.0 · Supabase (PostgreSQL 15) · idempotent script
-- ----------------------------------------------------------------------------
--  CONVENTIONS
--  · uuid PKs · timestamptz everywhere · soft refs via ON DELETE SET NULL
--  · Users live in Supabase Auth (auth.users); public.profiles extends them
--    and is auto-provisioned by the `on_auth_user_created` trigger.
--  · RLS is enabled on EVERY table (least-privilege policies in §13).
--  · Arrays are text[]; extensible metadata is jsonb.
--  · The local sandbox build mirrors this schema 1:1 via Prisma + SQLite
--    (see prisma/schema.prisma).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- trigram fuzzy search

-- ----------------------------------------------------------------------------
-- 1) PROFILES  (app-facing USERS)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text        not null unique,
  full_name            text        not null default '',
  display_name         text,
  headline             text,                    -- e.g. "Full-Stack Developer & Reviewer"
  bio                  text,
  avatar_url           text,
  location             text,
  website_url          text,
  socials              jsonb       not null default '{}'::jsonb,   -- {twitter,linkedin,github,instagram,youtube}
  role                 text        not null default 'reader'
                         check (role in ('reader','author','editor','admin')),
  onboarding_completed boolean     not null default false,
  onboarding_step      smallint    not null default 0,             -- 0..4
  marketing_opt_in     boolean     not null default true,
  is_active            boolean     not null default true,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.profiles is
  'App users. Provisioned automatically from Supabase Auth signups (trigger below).';

-- Auto-create a profile whenever Supabase Auth creates a user
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2) SHARED HELPER FUNCTIONS
-- ----------------------------------------------------------------------------
-- updated_at maintainer (attached in each table)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- role gate used by RLS policies (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('editor','admin')
    ), false
  );
$$;

-- block role / activation self-escalation on profiles
create or replace function public.guard_profile_mutations()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role <> old.role or new.is_active <> old.is_active)
     and not public.is_admin() then
    raise exception 'SECURITY: role/is_active may only be changed by an admin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_mutations();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3) CATEGORIES  (shared by blog + store)
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  scope       text not null default 'blog' check (scope in ('blog','store')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4) POSTS
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  title                text not null,
  excerpt              text,
  content              text not null default '',          -- markdown
  cover_image_url      text,
  status               text not null default 'draft'
                         check (status in ('draft','published','archived')),
  is_featured          boolean not null default false,
  tags                 text[] not null default '{}'::text[],
  reading_time_minutes integer not null default 1,
  views_count          integer not null default 0,
  -- SEO columns
  seo_title            text,
  seo_description      text,
  og_image_url         text,
  canonical_url        text,
  author_id            uuid references public.profiles (id) on delete set null,
  category_id          uuid references public.categories (id) on delete set null,
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5) PRODUCTS  (affiliate store)
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  tagline          text,
  description      text,                       -- markdown
  brand            text,
  merchant         text,                       -- e.g. 'Amazon', 'Flipkart'
  image_url        text,
  gallery          text[] not null default '{}'::text[],
  price            numeric(10,2),
  compare_at_price numeric(10,2),
  currency         text not null default 'USD',
  affiliate_url    text not null,
  pros             text[] not null default '{}'::text[],
  cons             text[] not null default '{}'::text[],
  key_specs        jsonb not null default '{}'::jsonb,
  rating           numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count     integer not null default 0,
  status           text not null default 'active'
                     check (status in ('active','draft','archived')),
  is_featured      boolean not null default false,
  clicks_count     integer not null default 0,          -- maintained by trigger §10
  category_id      uuid references public.categories (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6) INQUIRIES  (contact / sponsorship / partnership)
-- ----------------------------------------------------------------------------
create table if not exists public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  name          text not null,
  email         text not null,
  phone         text,
  type          text not null default 'general'
                  check (type in ('general','sponsorship','partnership','advertising','support','feedback')),
  subject       text,
  message       text not null,
  status        text not null default 'new'
                  check (status in ('new','in_progress','replied','closed','spam')),
  priority      text not null default 'normal'
                  check (priority in ('low','normal','high','urgent')),
  internal_note text,                             -- admin-only
  replied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_inquiries_updated_at on public.inquiries;
create trigger trg_inquiries_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7) PLANS  (billing catalog)
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- free | pro | business
  name          text not null,
  description   text,
  price_monthly numeric(10,2) not null default 0,
  price_yearly  numeric(10,2) not null default 0,
  currency      text not null default 'USD',
  features      text[] not null default '{}'::text[],
  limits        jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  is_default    boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_plans_updated_at on public.plans;
create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8) SUBSCRIPTIONS  (mock billing lifecycle) + audit events
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  plan_id              uuid not null references public.plans (id) on delete restrict,
  billing_interval     text not null default 'monthly'
                         check (billing_interval in ('monthly','yearly')),
  status               text not null default 'trialing'
                         check (status in ('trialing','active','past_due','canceled','expired')),
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at          timestamptz,
  payment_brand        text,        -- mock, e.g. 'Visa'
  payment_last4        text,        -- mock, e.g. '4242'
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- append-only audit trail (doubles as mock invoice history)
create table if not exists public.subscription_events (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null check (type in
                    ('created','plan_changed','interval_changed','renewed','canceled',
                     'resumed','payment_succeeded','payment_failed','trial_ended')),
  amount          numeric(10,2),
  currency        text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9) NEWSLETTER SUBSCRIBERS
-- ----------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','unsubscribed')),
  confirm_token   text unique,
  source          text not null default 'blog',   -- blog|store|footer|lead_magnet
  subscribed_at   timestamptz not null default now(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz
);

-- ----------------------------------------------------------------------------
-- 10) AFFILIATE CLICKS  (outbound tracking)
-- ----------------------------------------------------------------------------
create table if not exists public.affiliate_clicks (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  session_id text not null,
  ip_hash    text,                       -- sha256, PII-safe
  user_agent text,
  referrer   text,
  device     text,                       -- mobile|desktop|tablet
  country    text,
  clicked_at timestamptz not null default now()
);

-- keep products.clicks_count in sync automatically
create or replace function public.bump_product_clicks()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.products
     set clicks_count = clicks_count + 1
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_clicks_bump on public.affiliate_clicks;
create trigger trg_clicks_bump
  after insert on public.affiliate_clicks
  for each row execute function public.bump_product_clicks();

-- ----------------------------------------------------------------------------
-- 11) VISITOR SESSIONS  (presence — live user counter)
-- ----------------------------------------------------------------------------
create table if not exists public.visitor_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null unique,
  user_id         uuid references public.profiles (id) on delete set null,
  path            text not null default '/',
  referrer        text,
  device          text,                       -- mobile|desktop|tablet
  country         text,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  heartbeat_count integer not null default 1,
  is_online       boolean not null default true
);

-- live counter (75s freshness window = 3 missed 25s heartbeats)
create or replace view public.online_users_count as
  select count(*)::int as online
  from public.visitor_sessions
  where last_seen_at > now() - interval '75 seconds';

-- callable by anon/authenticated (REST fallback for the realtime counter)
create or replace function public.get_online_count()
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from public.visitor_sessions
  where last_seen_at > now() - interval '75 seconds';
$$;

-- offline sweep — schedule via pg_cron, or call from an edge function
create or replace function public.sweep_presence()
returns integer language plpgsql as $$
declare n integer;
begin
  update public.visitor_sessions
     set is_online = false
   where is_online and last_seen_at < now() - interval '75 seconds';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12) SITE SETTINGS  (maintenance mode & runtime flags)
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values ('maintenance', '{"enabled":false,"message":"We are performing scheduled maintenance. Back shortly."}'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 13) ROW LEVEL SECURITY — enabled on every table
-- ----------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.posts                  enable row level security;
alter table public.products               enable row level security;
alter table public.inquiries              enable row level security;
alter table public.plans                  enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.subscription_events    enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.affiliate_clicks       enable row level security;
alter table public.visitor_sessions       enable row level security;
alter table public.site_settings          enable row level security;

-- profiles -------------------------------------------------------------------
create policy "profiles: read — self, staff, or public personas"
  on public.profiles for select
  using ( id = auth.uid() or public.is_admin()
          or role in ('author','editor','admin') );
-- (INSERT happens only via the security-definer signup trigger — no policy.)
create policy "profiles: update — self or admin"
  on public.profiles for update
  using ( id = auth.uid() or public.is_admin() )
  with check ( id = auth.uid() or public.is_admin() );

-- categories -------------------------------------------------------------------
create policy "categories: public read"
  on public.categories for select using (true);
create policy "categories: staff write"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- posts -------------------------------------------------------------------------
create policy "posts: read — published, own drafts, staff"
  on public.posts for select
  using ( status = 'published' or author_id = auth.uid() or public.is_admin() );
create policy "posts: insert — own"
  on public.posts for insert to authenticated
  with check ( author_id = auth.uid() or public.is_admin() );
create policy "posts: update — own or staff"
  on public.posts for update to authenticated
  using ( author_id = auth.uid() or public.is_admin() )
  with check ( author_id = auth.uid() or public.is_admin() );
create policy "posts: delete — own or staff"
  on public.posts for delete to authenticated
  using ( author_id = auth.uid() or public.is_admin() );

-- products ------------------------------------------------------------------------
create policy "products: read — active or staff"
  on public.products for select
  using ( status = 'active' or public.is_admin() );
create policy "products: staff write"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- inquiries -------------------------------------------------------------------------
create policy "inquiries: anyone may submit"
  on public.inquiries for insert to anon, authenticated
  with check ( user_id is null or user_id = auth.uid() );
create policy "inquiries: read — own or staff"
  on public.inquiries for select
  using ( user_id = auth.uid() or public.is_admin() );
create policy "inquiries: staff triage"
  on public.inquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- plans ------------------------------------------------------------------------------
create policy "plans: public read"
  on public.plans for select using (true);
create policy "plans: staff write"
  on public.plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- subscriptions -----------------------------------------------------------------------
create policy "subscriptions: read — own or staff"
  on public.subscriptions for select
  using ( user_id = auth.uid() or public.is_admin() );
create policy "subscriptions: create — own"
  on public.subscriptions for insert to authenticated
  with check ( user_id = auth.uid() );
create policy "subscriptions: update — own or staff"
  on public.subscriptions for update to authenticated
  using ( user_id = auth.uid() or public.is_admin() )
  with check ( user_id = auth.uid() or public.is_admin() );

-- subscription_events -------------------------------------------------------------------
create policy "events: read — own or staff"
  on public.subscription_events for select
  using ( user_id = auth.uid() or public.is_admin() );
create policy "events: insert — own"
  on public.subscription_events for insert to authenticated
  with check ( user_id = auth.uid() );

-- newsletter -------------------------------------------------------------------------------
create policy "newsletter: anyone may subscribe"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);
create policy "newsletter: staff read"
  on public.newsletter_subscribers for select using (public.is_admin());
create policy "newsletter: staff manage"
  on public.newsletter_subscribers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- affiliate_clicks ---------------------------------------------------------------------------
create policy "clicks: anyone may log"
  on public.affiliate_clicks for insert to anon, authenticated
  with check ( user_id is null or user_id = auth.uid() );
create policy "clicks: staff read"
  on public.affiliate_clicks for select using (public.is_admin());

-- visitor_sessions -----------------------------------------------------------------------------
-- NOTE: presence rows are low-sensitivity. Session tokens are unguessable;
-- writes are confined to the client's own token in the app layer.
create policy "presence: heartbeat insert"
  on public.visitor_sessions for insert
  with check (true);
create policy "presence: heartbeat update"
  on public.visitor_sessions for update
  using (true) with check (true);
create policy "presence: staff read"
  on public.visitor_sessions for select using (public.is_admin());

-- site_settings ----------------------------------------------------------------------------------
create policy "settings: public read"
  on public.site_settings for select using (true);
create policy "settings: staff write"
  on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 14) INDEXES
-- ----------------------------------------------------------------------------
create index if not exists idx_posts_status_published on public.posts (status, published_at desc);
create index if not exists idx_posts_category         on public.posts (category_id);
create index if not exists idx_posts_author           on public.posts (author_id);
create index if not exists idx_posts_tags             on public.posts using gin (tags);
create index if not exists idx_posts_title_trgm       on public.posts using gin (title gin_trgm_ops);
create index if not exists idx_posts_featured         on public.posts (published_at desc)
  where is_featured and status = 'published';

create index if not exists idx_products_category      on public.products (category_id);
create index if not exists idx_products_price         on public.products (price);
create index if not exists idx_products_status_feat   on public.products (is_featured)
  where status = 'active';
create index if not exists idx_products_name_trgm     on public.products using gin (name gin_trgm_ops);

create index if not exists idx_inquiries_status       on public.inquiries (status, created_at desc);
create index if not exists idx_inquiries_email        on public.inquiries (email);

create index if not exists idx_subscriptions_user     on public.subscriptions (user_id);
create unique index if not exists uq_subscriptions_one_active_per_user
  on public.subscriptions (user_id)
  where status in ('trialing','active','past_due');

create index if not exists idx_events_subscription    on public.subscription_events (subscription_id, created_at desc);
create index if not exists idx_events_user            on public.subscription_events (user_id, created_at desc);

create index if not exists idx_clicks_product         on public.affiliate_clicks (product_id, clicked_at desc);
create index if not exists idx_clicks_session         on public.affiliate_clicks (session_id);

create index if not exists idx_presence_online        on public.visitor_sessions (last_seen_at)
  where is_online;
create index if not exists idx_presence_user          on public.visitor_sessions (user_id);

-- ----------------------------------------------------------------------------
-- 15) SEED — subscription plans
-- ----------------------------------------------------------------------------
insert into public.plans
  (code, name, description, price_monthly, price_yearly, currency, features, is_default, sort_order)
values
  ('free', 'Free Reader',
   'Full access to every published post and store listing.',
   0, 0, 'USD',
   array['All blog posts','All store listings & comparisons','Weekly newsletter'],
   true, 0),
  ('pro', 'Pro Member',
   'Premium deep-dives, early deal alerts and saved comparisons.',
   4.99, 49.90, 'USD',
   array['Everything in Free','Premium in-depth guides','Early deal alerts','Save & compare products','Ad-free reading'],
   false, 1),
  ('business', 'Business',
   'For sponsors and teams: outreach inbox, media kit and priority replies.',
   19.99, 199.90, 'USD',
   array['Everything in Pro','Sponsorship inbox','Media kit access','Priority replies (48h)','API access (beta)'],
   false, 2)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 16) REALTIME WIRING (free-tier friendly) + BOOTSTRAP
-- ----------------------------------------------------------------------------
-- LIVE COUNTER (recommended): use Supabase Realtime broadcast/presence
-- channels (websocket-only — no DB writes, no WAL, no connection per
-- heartbeat). visitor_sessions + get_online_count() serve ONLY as the REST
-- fallback for clients beyond the 200-connection realtime limit. Keep one
-- sweep job running:
--   select cron.schedule('sweep-presence', '* * * * *', 'select public.sweep_presence()');
--
-- ADMIN LIVE INBOX (optional): stream new inquiries into the dashboard:
--   alter table public.inquiries replica identity full;
--   alter publication supabase_realtime add table public.inquiries;
--
-- BOOTSTRAP FIRST ADMIN (run once after your first signup):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
