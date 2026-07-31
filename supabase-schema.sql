-- Hochzeitsfotos – Supabase-Schema
-- Einmal komplett in den Supabase SQL-Editor einfügen und ausführen
-- (Dashboard → SQL Editor → "New query" → einfügen → "Run").

-- 1) Tabellen ---------------------------------------------------------------

create table if not exists counters (
  name text primary key,          -- normalisierter Gästename
  display_name text not null,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null,
  guest_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_created_at_idx on photos (created_at desc);

-- 2) Zeilenschutz (RLS) -------------------------------------------------------
-- counters: gar kein direkter Tabellenzugriff — nur über die Funktionen unten.
alter table counters enable row level security;

-- photos: öffentlich lesbar (geteilte Galerie), Einfügen nur über die Funktion
-- unten, Löschen nur für angemeldete Admins (Moderation).
alter table photos enable row level security;

create policy "photos_public_read" on photos
  for select using (true);

create policy "photos_admin_delete" on photos
  for delete using (auth.role() = 'authenticated');

-- 3) Limit-Erzwingung: eine atomare Funktion statt Client-Transaktion --------
-- SECURITY DEFINER = läuft mit erhöhten Rechten, umgeht RLS auf counters/photos.
-- Genau das ist beabsichtigt: nur diese Funktion darf counters/photos anfassen.

create or replace function get_remaining(p_name text)
returns int
language sql
security definer
set search_path = public
as $$
  select 20 - coalesce((select count from counters where name = p_name), 0);
$$;

create or replace function submit_photo(
  p_name text,
  p_display_name text,
  p_storage_path text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into counters (name, display_name, count, updated_at)
  values (p_name, p_display_name, 1, now())
  on conflict (name) do update
    set count = counters.count + 1,
        display_name = excluded.display_name,
        updated_at = now()
    where counters.count < 20
  returning count into v_count;

  if v_count is null then
    raise exception 'LIMIT_REACHED';
  end if;

  insert into photos (normalized_name, guest_name, storage_path)
  values (p_name, p_display_name, p_storage_path);

  return v_count;
end;
$$;

-- Nur anonyme Gäste (und angemeldete Admins) dürfen diese Funktionen aufrufen.
grant execute on function get_remaining(text) to anon, authenticated;
grant execute on function submit_photo(text, text, text) to anon, authenticated;

-- 4) Storage-Bucket -----------------------------------------------------------
-- Bucket manuell im Dashboard anlegen (Storage → "New bucket" → Name "photos",
-- "Public bucket" aktivieren) — siehe SETUP.md. Die Policies unten danach hier
-- im SQL-Editor ausführen (der Bucket muss vorher existieren).

create policy "photos_bucket_public_read" on storage.objects
  for select using (bucket_id = 'photos');

-- Größen-/Typ-Limit NICHT hier prüfen: `metadata` ist beim Insert-Check noch
-- nicht zuverlässig gesetzt (führt zu "new row violates row-level security
-- policy" bei jedem Upload). Stattdessen im Dashboard am Bucket selbst
-- einstellen: Storage → Bucket "photos" → Edit bucket → "File size limit" (8MB)
-- und "Allowed MIME types" (image/*).
create policy "photos_bucket_public_upload" on storage.objects
  for insert with check (bucket_id = 'photos');

create policy "photos_bucket_admin_delete" on storage.objects
  for delete using (bucket_id = 'photos' and auth.role() = 'authenticated');
