# SETUP — Supabase para Nosotros

Todo con el plan gratuito de Supabase. Son unos 10 minutos y solo lo hace
**una** de las dos personas.

## 1. Crear el proyecto

1. Entra en <https://supabase.com> y crea una cuenta (gratis, sin tarjeta).
2. **New project**. Nombre: `nosotros`. Elige una contraseña para la base de
   datos (guárdala, aunque la app no la usa) y la región más cercana.
3. Espera a que termine de crearse (1–2 min).

> ¿Ya tienes el proyecto del Armario y no quieres crear otro? Puedes usar el
> mismo: las tablas de Nosotros (`albums`, `album_members`, `photos`) y su
> bucket (`nosotros`) no chocan con las del Armario. El plan gratuito permite
> 2 proyectos activos.

## 2. Activar el inicio de sesión anónimo

La app no pide email ni contraseña: cada teléfono entra como usuario anónimo
y el código de 6 caracteres es lo que une a los dos.

**Authentication → Sign In / Providers → «Allow anonymous sign-ins» → activar → Save.**

(Si ves «Confirm email», no afecta: los anónimos no usan email.)

## 3. Crear tablas, políticas y bucket

**SQL Editor → New query →** pega el bloque de abajo entero → **Run**.
Debe terminar con «Success. No rows returned». Se puede ejecutar más de una
vez sin romper nada. (Es el mismo contenido que `supabase/schema.sql`.)

Crea:

- `albums`, `album_members`, `photos`, con RLS activado: cada persona solo ve
  y toca el álbum en el que está, y nadie más.
- Funciones `create_album`, `join_album`, `my_album`, `leave_album`,
  `remove_partner`: el emparejamiento pasa solo por ellas (máximo 2 personas
  por álbum, comprobado en la base de datos).
- El bucket privado `nosotros` en Storage (máx. 5 MB por archivo, solo JPEG),
  con políticas para que solo los miembros del álbum lean, suban y borren.

```sql
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
```

Comprobación rápida: en **Table Editor** aparecen `albums`, `album_members` y
`photos` con el candado de RLS, y en **Storage** el bucket `nosotros`.

## 4. Copiar la URL y la clave pública

- **URL**: Project Settings → **Data API** → «Project URL»
  (`https://xxxxxxxxxxxx.supabase.co`).
- **Clave pública**: Project Settings → **API Keys** → la **Publishable key**
  (`sb_publishable_…`). Si tu proyecto muestra las claves antiguas, la
  **anon / public** (empieza por `eyJ…`) también sirve.

⚠️ **Nunca** uses la *secret key* ni la *service_role*: se saltan la seguridad.
La clave pública está pensada para ir dentro de la app; lo que protege las
fotos son las políticas RLS del paso 3.

## 5. Dónde poner la URL y la clave

Hay dos formas. Ninguna sube nada al repo.

### Opción A — en la propia app (no hace falta compilar)

La APK ya compilada no lleva ninguna clave. Al abrirla por primera vez pide
la URL y la clave: pégalas y toca «Guardar y continuar». El segundo teléfono
no tiene que pegar nada: recibirá una **invitación** que ya las incluye (ver
README.md).

### Opción B — en `local.properties` (quedan dentro de la APK)

En la carpeta `android/`:

```bash
cp local.properties.example local.properties
```

y rellena:

```properties
sdk.dir=/ruta/a/Android/Sdk
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

`local.properties` está en `.gitignore`. También valen variables de entorno
con esos mismos nombres (útil en CI). Después compila:

```bash
./gradlew assembleDebug
```

Con la opción B la app se salta la pantalla de configuración.

## 6. Límites del plan gratuito (de sobra para dos)

| Recurso | Gratis | Uso de Nosotros |
|---|---|---|
| Storage | 1 GB | ~150–250 KB por foto → unas 4 000–6 000 fotos |
| Base de datos | 500 MB | unas pocas filas por foto |
| Usuarios | 50 000 activos/mes | 2 |
| Pausa por inactividad | tras 7 días sin uso | el widget consulta el servidor cada 15–60 min, así que el proyecto se mantiene activo mientras haya un widget puesto |

Si alguna vez se pausa: entra al panel de Supabase y pulsa **Restore**; las
fotos siguen ahí y el widget sigue mostrando las guardadas en el teléfono.

## Problemas frecuentes

| Mensaje en la app | Solución |
|---|---|
| «Falta activar Allow anonymous sign-ins» | Paso 2 |
| «Falta ejecutar el SQL de SETUP.md» | Paso 3 (vuelve a ejecutarlo entero) |
| «La clave de Supabase no es válida» | Paso 4: copia la *publishable* / *anon*, no la secret |
| «Ese álbum ya tiene a sus dos personas» | Uno de los dos reinstaló la app y perdió su sesión. El otro: Ajustes (⋮) → «Liberar el lugar de mi pareja», y luego volver a unirse con el código |
