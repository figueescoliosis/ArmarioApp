-- Esquema inicial de Armario Inteligente.
-- Pensado para pegarse de una sola vez en el editor SQL de Supabase.
-- Es idempotente donde tiene sentido serlo (tablas e índices), para poder
-- volver a ejecutarlo sin que falle si ya existe.

create extension if not exists pgcrypto;

-- ─────────────────────────────── Prendas ───────────────────────────────

create table if not exists garments (
  id uuid primary key default gen_random_uuid(),
  -- La app no tiene login: todas las filas pertenecen a 'default' hasta que
  -- exista multiusuario. Mantener la columna desde ya hace esa migración trivial.
  owner_id text not null default 'default',
  image_url text not null,
  cutout_url text not null,
  thumb_url text,
  category text not null
    constraint garments_category_check
    check (category in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  subcategory text,
  colors jsonb not null default '[]',
  primary_hex text not null,
  is_neutral boolean not null default false,
  pattern text
    constraint garments_pattern_check
    check (pattern is null or pattern in ('solid', 'striped', 'checked', 'floral', 'print', 'other')),
  material text,
  style_tags text[] not null default '{}',
  formality smallint not null default 3
    constraint garments_formality_check check (formality between 1 and 5),
  warmth smallint not null default 3
    constraint garments_warmth_check check (warmth between 1 and 5),
  seasons text[] not null default '{}',
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists garments_owner_category_idx
  on garments (owner_id, category)
  where not archived;

-- ─────────────────────────────── Conjuntos ───────────────────────────────

create table if not exists outfits (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default 'default',
  name text,
  score numeric not null,
  score_breakdown jsonb not null default '{}',
  rationale text,
  source text not null default 'rules'
    constraint outfits_source_check check (source in ('rules', 'rules+llm')),
  -- Hash determinista del conjunto de garment_id (ver computeSignature en
  -- src/lib/db/outfits.ts). Sirve para no guardar dos veces el mismo conjunto
  -- aunque el motor lo genere de nuevo en otro orden.
  signature text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists outfits_owner_signature_uidx
  on outfits (owner_id, signature);

create table if not exists outfit_items (
  outfit_id uuid not null references outfits(id) on delete cascade,
  garment_id uuid not null references garments(id) on delete cascade,
  slot text not null
    constraint outfit_items_slot_check
    check (slot in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  primary key (outfit_id, garment_id)
);

create index if not exists outfit_items_garment_idx
  on outfit_items (garment_id);

-- ─────────────────────────────── Registro de uso ───────────────────────────────

create table if not exists wear_log (
  id bigserial primary key,
  garment_id uuid references garments(id) on delete cascade,
  worn_at date not null default current_date
);

create index if not exists wear_log_garment_idx
  on wear_log (garment_id, worn_at desc);

-- ─────────────────────────────── Storage ───────────────────────────────
--
-- El bucket de imágenes se crea a mano desde el panel de Supabase (Storage
-- no se gestiona con SQL de forma portable). Pasos:
--
--   1. Storage → New bucket.
--   2. Nombre exacto: garments
--   3. Marcar "Public bucket" (las URLs públicas se sirven directamente al
--      navegador; el navegador nunca usa la service role key para escribir).
--   4. No hace falta configurar políticas RLS de Storage para lectura pública
--      porque el bucket ya es público; las subidas/borrados los hace siempre
--      el servidor con la service role key, que se salta RLS.
