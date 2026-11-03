-- Wunschfunken: Einmal vollständig im Supabase SQL Editor ausführen.
-- Danach einen Auth-Benutzer erstellen und dessen UUID in public.admins eintragen.
create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.admins (
 id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.gifts (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 120),
 url text not null check (url ~* '^https://[^[:space:]]+$'),
 image_url text check (image_url is null or image_url ~* '^https://[^[:space:]]+$'),
 note text check (note is null or char_length(note)<=500),
 status text not null default 'frei' check (status in ('frei','reserviert','bestellt')),
 created_at timestamptz not null default now(),
 status_updated_at timestamptz not null default now()
);
-- Der geheime Reservierungsschlüssel darf nie öffentlich gelesen werden.
create table if not exists public.gift_claims (
 gift_id uuid primary key references public.gifts(id) on delete cascade,
 secret text not null check (char_length(secret) between 40 and 200),
 created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.gifts enable row level security;
alter table public.gift_claims enable row level security;

revoke all on public.admins, public.gifts, public.gift_claims from anon, authenticated;
grant select on public.gifts to anon, authenticated;
grant insert, update, delete on public.gifts to authenticated;
grant select on public.admins to authenticated;

create policy "Admin sees own admin entry"
 on public.admins for select to authenticated using (id=(select auth.uid()));
create policy "Everyone reads gifts"
 on public.gifts for select to anon, authenticated using (true);
create policy "Only admin inserts gifts"
 on public.gifts for insert to authenticated
 with check (exists(select 1 from public.admins a where a.id=(select auth.uid())));
create policy "Only admin updates gifts"
 on public.gifts for update to authenticated
 using (exists(select 1 from public.admins a where a.id=(select auth.uid())))
 with check (exists(select 1 from public.admins a where a.id=(select auth.uid())));
create policy "Only admin deletes gifts"
 on public.gifts for delete to authenticated
 using (exists(select 1 from public.admins a where a.id=(select auth.uid())));

-- Sicheres Reservieren: ein bedingtes UPDATE blockiert konkurrierende Reservierungen.
create or replace function private.reserve_gift(p_gift_id uuid,p_secret text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_secret is null or char_length(p_secret)<40 or char_length(p_secret)>200 then return false; end if;
 update public.gifts set status='reserviert',status_updated_at=now()
 where id=p_gift_id and status='frei';
 get diagnostics n=row_count;
 if n<>1 then return false; end if;
 insert into public.gift_claims(gift_id,secret) values(p_gift_id,p_secret);
 return true;
end;
$$;

create or replace function private.mark_gift_ordered(p_gift_id uuid,p_secret text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.gifts g set status='bestellt',status_updated_at=now()
 where g.id=p_gift_id and g.status='reserviert'
 and exists(select 1 from public.gift_claims c where c.gift_id=g.id and c.secret=p_secret);
 get diagnostics n=row_count;
 return n=1;
end;
$$;

create or replace function private.release_gift(p_gift_id uuid,p_secret text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.gifts g set status='frei',status_updated_at=now()
 where g.id=p_gift_id and g.status='reserviert'
 and exists(select 1 from public.gift_claims c where c.gift_id=g.id and c.secret=p_secret);
 get diagnostics n=row_count;
 if n<>1 then return false; end if;
 delete from public.gift_claims where gift_id=p_gift_id and secret=p_secret;
 return true;
end;
$$;

create or replace function private.admin_reset_gift(p_gift_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from public.admins a where a.id=(select auth.uid())) then
  raise exception 'Keine Verwaltungsberechtigung' using errcode='42501';
 end if;
 update public.gifts set status='frei',status_updated_at=now() where id=p_gift_id;
 get diagnostics n=row_count;
 if n<>1 then return false; end if;
 delete from public.gift_claims where gift_id=p_gift_id;
 return true;
end;
$$;

-- API-Hüllen: Aufrufbar, aber ohne erhöhte Rechte.
create or replace function public.reserve_gift(p_gift_id uuid,p_secret text)
returns boolean language sql security invoker set search_path=''
as $$ select private.reserve_gift(p_gift_id,p_secret); $$;
create or replace function public.mark_gift_ordered(p_gift_id uuid,p_secret text)
returns boolean language sql security invoker set search_path=''
as $$ select private.mark_gift_ordered(p_gift_id,p_secret); $$;
create or replace function public.release_gift(p_gift_id uuid,p_secret text)
returns boolean language sql security invoker set search_path=''
as $$ select private.release_gift(p_gift_id,p_secret); $$;
create or replace function public.admin_reset_gift(p_gift_id uuid)
returns boolean language sql security invoker set search_path=''
as $$ select private.admin_reset_gift(p_gift_id); $$;

-- Das Schema private darf NICHT in Supabase unter Exposed Schemas stehen.
grant usage on schema private to anon, authenticated;
revoke execute on function
 private.reserve_gift(uuid,text),
 private.mark_gift_ordered(uuid,text),
 private.release_gift(uuid,text),
 private.admin_reset_gift(uuid),
 public.reserve_gift(uuid,text),
 public.mark_gift_ordered(uuid,text),
 public.release_gift(uuid,text),
 public.admin_reset_gift(uuid) from public, anon, authenticated;
grant execute on function
 private.reserve_gift(uuid,text),
 private.mark_gift_ordered(uuid,text),
 private.release_gift(uuid,text),
 public.reserve_gift(uuid,text),
 public.mark_gift_ordered(uuid,text),
 public.release_gift(uuid,text) to anon, authenticated;
grant execute on function private.admin_reset_gift(uuid),public.admin_reset_gift(uuid) to authenticated;

-- Live-Synchronisierung; zusätzlich erfolgt ein Aktualisieren alle 20 Sekunden.
do $realtime$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='gifts') then
  alter publication supabase_realtime add table public.gifts;
 end if;
end;
$realtime$;

-- Nach dem Anlegen des Admin-Benutzers separat ausführen:
-- insert into public.admins(id) values('DEINE-ADMIN-USER-UUID');
