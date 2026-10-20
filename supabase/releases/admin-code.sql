create table sadooh_private.admin_secrets(user_id uuid primary key references auth.users(id),salt text not null,hash text not null,created_at timestamptz not null default clock_timestamp());
create table sadooh_private.admin_unlocks(user_id uuid not null references auth.users(id),session_id uuid not null,expires_at timestamptz not null,primary key(user_id,session_id));
alter table sadooh_private.admin_secrets enable row level security;
alter table sadooh_private.admin_unlocks enable row level security;
revoke all on sadooh_private.admin_secrets,sadooh_private.admin_unlocks from public,anon,authenticated;
grant all on sadooh_private.admin_secrets,sadooh_private.admin_unlocks to service_role;
create function sadooh_private.live_session(p_uid uuid,p_session uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'service_role' and auth.uid() is distinct from p_uid then return false; end if;
 return exists(select 1 from auth.sessions where id=p_session and user_id=p_uid);
end $$;
revoke all on function sadooh_private.live_session(uuid,uuid) from public,anon,authenticated;
grant execute on function sadooh_private.live_session(uuid,uuid) to service_role;
create function public.sadooh_admin_gate(p_uid uuid,p_session uuid,p_action text default 'STATUS',p_code text default '') returns jsonb language plpgsql set search_path='' as $$
declare u record; secret sadooh_private.admin_secrets; inserted integer;
begin
 select * into u from sadooh_private.account_identity(p_uid);
 if u.id is null or u.is_anonymous or lower(u.email)<>'sadoh.inquiries@gmail.com' or not sadooh_private.live_session(p_uid,p_session) then raise exception 'ADMIN_SESSION_REQUIRED';end if;
 select * into secret from sadooh_private.admin_secrets where user_id=p_uid;
 if p_action in ('SETUP','UNLOCK') then
  if length(p_code)<>16 or p_code !~ '[A-Za-z]' or p_code !~ '[0-9]' or p_code !~ '[!@#$%^&*()_+={}\[\]:;,.?/~<>|-]' or p_code ~ '[[:space:]]' then raise exception 'ADMIN_CODE_FORMAT';end if;
  if p_action='SETUP' then
   if secret.user_id is not null then raise exception 'ADMIN_CODE_ALREADY_SET';end if;
   secret.salt:=gen_random_uuid()::text;
   insert into sadooh_private.admin_secrets(user_id,salt,hash) values(p_uid,secret.salt,encode(sha256(convert_to(secret.salt||p_code,'UTF8')),'hex')) on conflict do nothing;
   get diagnostics inserted=row_count;if inserted<>1 then raise exception 'ADMIN_CODE_ALREADY_SET';end if;
  elsif secret.user_id is null or secret.hash<>encode(sha256(convert_to(secret.salt||p_code,'UTF8')),'hex') then raise exception 'ADMIN_CODE_INVALID';end if;
  insert into sadooh_private.admin_unlocks(user_id,session_id,expires_at) values(p_uid,p_session,clock_timestamp()+interval '30 days') on conflict(user_id,session_id) do update set expires_at=excluded.expires_at;
 elsif p_action<>'STATUS' then raise exception 'INVALID_ACTION';end if;
 return jsonb_build_object('setupRequired',not exists(select 1 from sadooh_private.admin_secrets where user_id=p_uid),'unlocked',exists(select 1 from sadooh_private.admin_unlocks where user_id=p_uid and session_id=p_session and expires_at>clock_timestamp()));
end $$;
revoke all on function public.sadooh_admin_gate(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.sadooh_admin_gate(uuid,uuid,text,text) to service_role;
