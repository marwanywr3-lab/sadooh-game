-- Additive schema for SADOOH only. No pre-existing objects are replaced.
create schema sadooh_private;
revoke all on schema sadooh_private from public, anon, authenticated;
grant usage on schema sadooh_private to service_role;

create table public.sadooh_rooms (
  code text primary key check (code ~ '^[A-F0-9]{32}$'),
  revision bigint not null default 0,
  state jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index sadooh_rooms_expiry_idx on public.sadooh_rooms(expires_at);
alter table public.sadooh_rooms enable row level security;
revoke all on public.sadooh_rooms from public, anon, authenticated;
grant all on public.sadooh_rooms to service_role;

create table public.sadooh_player_views (
  room_code text not null references public.sadooh_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  primary key (room_code,user_id)
);
create index sadooh_player_views_user_idx on public.sadooh_player_views(user_id);
alter table public.sadooh_player_views enable row level security;
revoke all on public.sadooh_player_views from public, anon, authenticated;
grant select on public.sadooh_player_views to authenticated;
grant all on public.sadooh_player_views to service_role;
create policy sadooh_read_own_projection on public.sadooh_player_views for select to authenticated
using (user_id=(select auth.uid()) and expires_at>now());
alter publication supabase_realtime add table public.sadooh_player_views;

create table sadooh_private.reports (
  id uuid primary key,
  room_code text not null,
  reporter uuid not null,
  target uuid not null,
  reason text not null check(length(reason)<=300),
  evidence jsonb,
  created_at timestamptz not null default now()
);
alter table sadooh_private.reports enable row level security;
grant all on sadooh_private.reports to service_role;
create index sadooh_reports_retention_idx on sadooh_private.reports(created_at);

create table sadooh_private.limits (
  key text primary key,
  started_at timestamptz not null,
  count integer not null
);
alter table sadooh_private.limits enable row level security;
grant all on sadooh_private.limits to service_role;

create function public.sadooh_allow(p_key text,p_window integer,p_max integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  insert into sadooh_private.limits(key,started_at,count) values(p_key,clock_timestamp(),1)
  on conflict(key) do update set
    started_at=case when sadooh_private.limits.started_at<clock_timestamp()-make_interval(secs=>p_window) then clock_timestamp() else sadooh_private.limits.started_at end,
    count=case when sadooh_private.limits.started_at<clock_timestamp()-make_interval(secs=>p_window) then 1 else sadooh_private.limits.count+1 end
  returning count into n;
  return n<=p_max;
end $$;
revoke all on function public.sadooh_allow(text,integer,integer) from public,anon,authenticated;
grant execute on function public.sadooh_allow(text,integer,integer) to service_role;

create function public.sadooh_load(p_code text) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('revision',revision,'state',state,'now',floor(extract(epoch from clock_timestamp())*1000))
 from public.sadooh_rooms where code=p_code and expires_at>clock_timestamp();
$$;
revoke all on function public.sadooh_load(text) from public,anon,authenticated;
grant execute on function public.sadooh_load(text) to service_role;

-- Compare-and-swap + all player projections + abuse evidence in one transaction.
create function public.sadooh_commit(p_code text,p_revision bigint,p_state jsonb,p_views jsonb,p_report jsonb default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer; expiry timestamptz; item jsonb;
begin
 expiry=to_timestamp((p_state->>'expires')::double precision/1000);
 if p_revision=-1 then
   insert into public.sadooh_rooms(code,revision,state,expires_at) values(p_code,0,p_state,expiry) on conflict do nothing;
 else
   update public.sadooh_rooms set state=p_state,revision=p_revision+1,expires_at=expiry,updated_at=clock_timestamp()
   where code=p_code and revision=p_revision and expires_at>clock_timestamp();
 end if;
 get diagnostics changed=row_count;
 if changed=0 then return false; end if;
 for item in select value from jsonb_array_elements(p_views) loop
   insert into public.sadooh_player_views(room_code,user_id,revision,payload,expires_at)
   values(p_code,(item->>'userId')::uuid,p_revision+1,item->'payload',expiry)
   on conflict(room_code,user_id) do update set revision=excluded.revision,payload=excluded.payload,expires_at=excluded.expires_at;
 end loop;
 delete from public.sadooh_player_views where room_code=p_code and user_id not in (select (value->>'userId')::uuid from jsonb_array_elements(p_views));
 if p_report is not null then
   insert into sadooh_private.reports(id,room_code,reporter,target,reason,evidence)
   values((p_report->>'id')::uuid,p_code,(p_report->>'reporter')::uuid,(p_report->>'target')::uuid,p_report->>'reason',p_report->'evidence');
 end if;
 return true;
end $$;
revoke all on function public.sadooh_commit(text,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sadooh_commit(text,bigint,jsonb,jsonb,jsonb) to service_role;
