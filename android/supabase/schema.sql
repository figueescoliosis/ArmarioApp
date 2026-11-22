-- Nosotros: álbum compartido para dos personas.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede ejecutar varias veces.
--
-- No choca con las tablas del Armario (garments, outfits, …): si quieres,
-- puedes usar el mismo proyecto de Supabase.

-- ─── Tablas ─────────────────────────────────────────────────────────────

create table if not exists public.albums (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.album_members (
  album_id   uuid not null references public.albums (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (album_id, user_id),
  unique (user_id)                      -- cada persona, en un solo álbum
);

create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  album_id      uuid not null references public.albums (id) on delete cascade,
  storage_path  text not null unique,
  uploaded_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists photos_album_created_idx
  on public.photos (album_id, created_at desc);

-- Permisos explícitos: hay proyectos nuevos que no exponen las tablas nuevas
-- a la Data API por defecto. anon no necesita nada: todo va con sesión.
grant usage on schema public to authenticated;
grant select on public.albums, public.album_members to authenticated;
grant select, insert, delete on public.photos to authenticated;
revoke all on public.albums, public.album_members, public.photos from anon;

alter table public.albums        enable row level security;
alter table public.album_members enable row level security;
alter table public.photos        enable row level security;

-- ─── Ayudantes (security definer: evitan recursión en las políticas) ─────

create or replace function public.is_album_member(p_album uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.album_members m
    where m.album_id = p_album and m.user_id = auth.uid()
  );
$$;

-- Para Storage: la primera carpeta de la ruta es el id del álbum.
create or replace function public.is_album_member_path(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.album_members m
    where m.user_id = auth.uid()
      and m.album_id::text = (storage.foldername(p_name))[1]
  );
$$;

-- ─── Políticas RLS ──────────────────────────────────────────────────────
-- Solo los miembros ven su álbum. Crear, unirse y salir va por las funciones
-- de abajo; nadie escribe directamente en albums ni en album_members.

drop policy if exists "miembros ven su album" on public.albums;
create policy "miembros ven su album" on public.albums
  for select to authenticated using (public.is_album_member(id));

drop policy if exists "miembros ven a los miembros" on public.album_members;
create policy "miembros ven a los miembros" on public.album_members
  for select to authenticated using (public.is_album_member(album_id));

drop policy if exists "miembros ven fotos" on public.photos;
create policy "miembros ven fotos" on public.photos
  for select to authenticated using (public.is_album_member(album_id));

drop policy if exists "miembros suben fotos" on public.photos;
create policy "miembros suben fotos" on public.photos
  for insert to authenticated with check (
    public.is_album_member(album_id)
    and uploaded_by = auth.uid()
    and storage_path like album_id::text || '/%'
  );

drop policy if exists "miembros borran fotos" on public.photos;
create policy "miembros borran fotos" on public.photos
  for delete to authenticated using (public.is_album_member(album_id));

-- ─── Funciones de emparejamiento ────────────────────────────────────────

-- Álbum del usuario actual, o null si no está en ninguno.
create or replace function public.my_album()
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'album_id', a.id,
    'code', a.code,
    'members', (select count(*) from public.album_members x where x.album_id = a.id)
  )
  from public.album_members m
  join public.albums a on a.id = m.album_id
  where m.user_id = auth.uid();
$$;

-- Crea un álbum con un código de 6 caracteres (sin 0/O ni 1/I/L).
create or replace function public.create_album()
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_bytes    bytea;
  v_album    uuid;
begin
  if v_uid is null then raise exception 'SIN_SESION'; end if;
  if exists (select 1 from public.album_members where user_id = v_uid) then
    raise exception 'YA_TIENES_ALBUM';
  end if;

  loop
    -- gen_random_uuid() usa el generador criptográfico de Postgres.
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.albums where code = v_code);
  end loop;

  insert into public.albums (code, created_by) values (v_code, v_uid) returning id into v_album;
  insert into public.album_members (album_id, user_id) values (v_album, v_uid);
  return json_build_object('album_id', v_album, 'code', v_code, 'members', 1);
end;
$$;

-- Se une a un álbum por código. Máximo dos personas por álbum.
create or replace function public.join_album(p_code text)
returns json
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_album  public.albums%rowtype;
  v_count  int;
begin
  if v_uid is null then raise exception 'SIN_SESION'; end if;

  -- for update: dos personas uniéndose a la vez no pueden pasar de 2.
  select * into v_album from public.albums
  where code = upper(trim(p_code))
  for update;
  if not found then raise exception 'CODIGO_INVALIDO'; end if;

  if not exists (select 1 from public.album_members where album_id = v_album.id and user_id = v_uid) then
    if exists (select 1 from public.album_members where user_id = v_uid) then
      raise exception 'YA_TIENES_ALBUM';
    end if;
    select count(*) into v_count from public.album_members where album_id = v_album.id;
    if v_count >= 2 then raise exception 'ALBUM_LLENO'; end if;
    insert into public.album_members (album_id, user_id) values (v_album.id, v_uid);
  end if;

  return json_build_object(
    'album_id', v_album.id,
    'code', v_album.code,
    'members', (select count(*) from public.album_members where album_id = v_album.id)
  );
end;
$$;

-- Sale del álbum. Si era la última persona, el álbum y sus filas se borran
-- (la app borra antes los archivos de Storage).
create or replace function public.leave_album()
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_album uuid;
begin
  delete from public.album_members where user_id = auth.uid() returning album_id into v_album;
  if v_album is not null and not exists (select 1 from public.album_members where album_id = v_album) then
    delete from public.albums where id = v_album;
  end if;
end;
$$;

-- Libera el lugar de la pareja (p. ej. si reinstaló la app y perdió su
-- sesión). Después puede volver a entrar con el mismo código.
create or replace function public.remove_partner()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.album_members
  where user_id <> auth.uid()
    and album_id = (select album_id from public.album_members where user_id = auth.uid());
$$;

revoke execute on function public.my_album()        from public, anon;
revoke execute on function public.create_album()    from public, anon;
revoke execute on function public.join_album(text)  from public, anon;
revoke execute on function public.leave_album()     from public, anon;
revoke execute on function public.remove_partner()  from public, anon;
grant  execute on function public.my_album()        to authenticated;
grant  execute on function public.create_album()    to authenticated;
grant  execute on function public.join_album(text)  to authenticated;
grant  execute on function public.leave_album()     to authenticated;
grant  execute on function public.remove_partner()  to authenticated;

-- ─── Storage: bucket privado «nosotros» ─────────────────────────────────
-- Rutas: <album_id>/<photo_id>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nosotros', 'nosotros', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists "nosotros: miembros leen" on storage.objects;
create policy "nosotros: miembros leen" on storage.objects
  for select to authenticated
  using (bucket_id = 'nosotros' and public.is_album_member_path(name));

drop policy if exists "nosotros: miembros suben" on storage.objects;
create policy "nosotros: miembros suben" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nosotros' and public.is_album_member_path(name));

drop policy if exists "nosotros: miembros borran" on storage.objects;
create policy "nosotros: miembros borran" on storage.objects
  for delete to authenticated
  using (bucket_id = 'nosotros' and public.is_album_member_path(name));
