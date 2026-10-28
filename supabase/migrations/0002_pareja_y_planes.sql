-- Conjuntos de pareja guardados y planes en el calendario.
-- Se pega en el editor SQL de Supabase después de 0001. Idempotente.

-- ─────────────────────────────── Pares ───────────────────────────────
--
-- Un par une dos conjuntos de `outfits`, uno de cada armario. Los dos looks se
-- guardan con `is_favorite = false`: el favorito es el par, y así no aparecen
-- sueltos en los favoritos de cada uno.

create table if not exists couple_outfits (
  id uuid primary key default gen_random_uuid(),
  owner_a text not null,
  owner_b text not null,
  outfit_a uuid not null references outfits(id) on delete cascade,
  outfit_b uuid not null references outfits(id) on delete cascade,
  score numeric not null,
  rationale text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists couple_outfits_pair_uidx
  on couple_outfits (outfit_a, outfit_b);

-- ─────────────────────────────── Planes ───────────────────────────────
--
-- Un conjunto (propio o mezclado) o un par, apuntado para un día. Los ven los
-- dos; solo quien lo apunta lo borra.

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  day date not null,
  outfit_id uuid references outfits(id) on delete cascade,
  couple_id uuid references couple_outfits(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint plans_one_target_check
    check ((outfit_id is null) <> (couple_id is null))
);

create index if not exists plans_day_idx on plans (day);

-- Igual que en 0001: RLS activado y sin políticas. El servidor usa la secret
-- key, que se lo salta, y la Data API no queda abierta con la clave anon.
alter table couple_outfits enable row level security;
alter table plans enable row level security;
