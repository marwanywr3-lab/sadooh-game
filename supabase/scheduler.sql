-- Scheduler touches only new SADOOH resources. No calls while no room is due.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
alter table public.sadooh_rooms add column dispatch_after timestamptz not null default now();
create table sadooh_private.scheduler_auth(hash text not null);
alter table sadooh_private.scheduler_auth enable row level security;
grant select on sadooh_private.scheduler_auth to service_role;
do $$ declare secret text:=encode(extensions.gen_random_bytes(32),'hex'); begin
 perform vault.create_secret(secret,'sadooh_scheduler_token','Internal SADOOH timer capability');
 insert into sadooh_private.scheduler_auth values(encode(extensions.digest(secret,'sha256'),'hex'));
end $$;
create function public.sadooh_scheduler_authorize(p_hash text) returns boolean
language sql security invoker set search_path='' as $$
 select exists(select 1 from sadooh_private.scheduler_auth where hash=p_hash);
$$;
revoke all on function public.sadooh_scheduler_authorize(text) from public,anon,authenticated;
grant execute on function public.sadooh_scheduler_authorize(text) to service_role;
create index sadooh_rooms_due_idx on public.sadooh_rooms(dispatch_after)
where state->'room'->>'status'='in_progress';
select cron.schedule('sadooh-room-timers','1 second',$job$
 with due as (
  select code from public.sadooh_rooms
  where state->'room'->>'status'='in_progress' and expires_at>clock_timestamp() and dispatch_after<=clock_timestamp()
  and least((state->>'deadline')::bigint,coalesce(nullif((state->>'nextBot')::bigint,0),9223372036854775807)) <= extract(epoch from clock_timestamp())*1000
  order by dispatch_after limit 20 for update skip locked
 ), leased as (
  update public.sadooh_rooms r set dispatch_after=clock_timestamp()+interval '3 seconds'
  from due where r.code=due.code returning r.code
 )
 select net.http_post(
  url:='https://cbnwfkehisqnnuvhsrgr.supabase.co/functions/v1/sadooh-api',
  headers:=jsonb_build_object('Content-Type','application/json'),
  body:=jsonb_build_object('type','SCHEDULED_TICK','roomCode',code,'scheduler',
   (select decrypted_secret from vault.decrypted_secrets where name='sadooh_scheduler_token')),
  timeout_milliseconds:=10000
 ) from leased;
$job$);
-- No automatic deletion: expired rooms are denied by the API and RLS.
