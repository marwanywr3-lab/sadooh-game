-- Separate administration; no email-based privilege grants.
alter table sadooh_private.accounts add column permanent_pro boolean not null default false;
alter table sadooh_private.pro_codes add column kind text not null default 'monthly' check(kind in ('monthly','permanent'));
alter table sadooh_private.pro_codes add column request_id uuid unique;
create table sadooh_private.code_admins(user_id uuid primary key references auth.users(id),enabled boolean not null default true,created_at timestamptz not null default clock_timestamp());
create table sadooh_private.code_audit(id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),kind text not null check(kind in ('monthly','permanent')),request_id uuid not null unique,created_at timestamptz not null default clock_timestamp());
create index code_audit_actor_time on sadooh_private.code_audit(actor,created_at);
alter table sadooh_private.code_admins enable row level security;
alter table sadooh_private.code_audit enable row level security;
revoke all on sadooh_private.code_admins,sadooh_private.code_audit from public,anon,authenticated;
grant all on sadooh_private.code_admins,sadooh_private.code_audit to service_role;
-- Small private helper needed because service_role cannot read auth.sessions directly.
create function sadooh_private.admin_live_session(p_uid uuid,p_session uuid,p_mfa boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'service_role' then raise exception 'FORBIDDEN';end if;
 return exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_uid and (s.not_after is null or s.not_after>clock_timestamp()))
 and exists(select 1 from auth.users u where u.id=p_uid and not u.is_anonymous and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 and (not p_mfa or exists(select 1 from auth.mfa_factors f where f.user_id=p_uid and f.status='verified' and f.factor_type='totp'));
end $$;
revoke all on function sadooh_private.admin_live_session(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function sadooh_private.admin_live_session(uuid,uuid,boolean) to service_role;
create function public.sadooh_codes_admin(p_uid uuid,p_session uuid,p_action text,p_aal text,p_mfa_at bigint,p_request uuid default null,p_kind text default null) returns jsonb language plpgsql set search_path='' as $$
declare owner_row sadooh_private.code_admins; token text; expiry timestamptz; n integer;
begin
 select * into owner_row from sadooh_private.code_admins where user_id=p_uid and enabled for update;
 if owner_row.user_id is null or not sadooh_private.admin_live_session(p_uid,p_session,false) then raise exception 'FORBIDDEN';end if;
 if p_action='STATUS' then return jsonb_build_object('authorized',true);end if;
 if p_action<>'ISSUE' or p_kind not in ('monthly','permanent') or p_kind is null or p_request is null then raise exception 'INVALID_ACTION';end if;
 if p_aal is distinct from 'aal2' or p_mfa_at is null or p_mfa_at<extract(epoch from clock_timestamp())-600 or p_mfa_at>extract(epoch from clock_timestamp())+30 or not sadooh_private.admin_live_session(p_uid,p_session,true) then raise exception 'MFA_REQUIRED';end if;
 select count(*) into n from sadooh_private.code_audit where actor=p_uid and created_at>clock_timestamp()-interval '1 minute';
 if n>=5 then raise exception 'RATE_LIMIT';end if;
 select count(*) into n from sadooh_private.code_audit where actor=p_uid and created_at>clock_timestamp()-interval '1 day';
 if n>=100 then raise exception 'RATE_LIMIT';end if;
 if exists(select 1 from sadooh_private.code_audit where request_id=p_request) then raise exception 'ALREADY_ISSUED';end if;
 token:=upper(replace(gen_random_uuid()::text,'-',''));expiry:=clock_timestamp()+interval '10 minutes';
 insert into sadooh_private.pro_codes(hash,issuer,expires_at,kind,request_id) values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_uid,expiry,p_kind,p_request);
 insert into sadooh_private.code_audit(actor,kind,request_id) values(p_uid,p_kind,p_request);
 return jsonb_build_object('code',token,'kind',p_kind,'expiresAt',expiry);
end $$;
revoke all on function public.sadooh_codes_admin(uuid,uuid,text,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.sadooh_codes_admin(uuid,uuid,text,text,bigint,uuid,text) to service_role;
create or replace function public.sadooh_account(p_uid uuid,p_action text default 'GET',p_value jsonb default '{}') returns jsonb language plpgsql set search_path='' as $$
declare u record; a sadooh_private.accounts; permanent boolean; is_admin boolean; pro boolean; used integer; c sadooh_private.pro_codes; code text; expiry timestamptz; month_key text;
begin
 select * into u from sadooh_private.account_identity(p_uid);
 if u.id is null or u.is_anonymous or u.email is null then raise exception 'CONFIRM_EMAIL'; end if;
 permanent:=false;
 is_admin:=false;
 insert into sadooh_private.accounts(user_id) values(p_uid) on conflict do nothing;
 select * into a from sadooh_private.accounts where user_id=p_uid for update;
 permanent:=a.permanent_pro;
 pro:=permanent or a.pro_until>clock_timestamp(); pro:=coalesce(pro,false);
 if p_action='SAVE_NAME' then
  if length(trim(p_value->>'username')) not between 1 and 24 or p_value->>'username' ~ '[<>[:cntrl:]]' then raise exception 'INVALID_NAME'; end if;
  update sadooh_private.accounts set username=trim(p_value->>'username') where user_id=p_uid;
 elsif p_action='SAVE_PREFS' then
  if not pro then raise exception 'PRO_REQUIRED'; end if;
  if coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'background','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'position','') not in ('top','bottom','left','right') then raise exception 'INVALID_PREFS'; end if;
  update sadooh_private.accounts set prefs=jsonb_build_object('background',p_value->>'background','position',p_value->>'position','badgeColor',coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f')) where user_id=p_uid;
 elsif p_action='ISSUE' then raise exception 'ADMIN_SEPARATE_SITE';
 elsif p_action='REDEEM' then
  code:=upper(regexp_replace(coalesce(p_value->>'code',''),'[ -]','','g'));
  if code !~ '^[A-F0-9]{32}$' then raise exception 'INVALID_CODE'; end if;
  select * into c from sadooh_private.pro_codes where hash=encode(sha256(convert_to(code,'UTF8')),'hex') for update;
  if c.hash is null or c.expires_at<=clock_timestamp() or c.redeemed_by is not null then raise exception 'INVALID_CODE'; end if;
  if c.kind='permanent' then
   update sadooh_private.accounts set permanent_pro=true where user_id=p_uid;
  else
   update sadooh_private.accounts set pro_until=greatest(coalesce(pro_until,clock_timestamp()),clock_timestamp())+interval '1 month' where user_id=p_uid;
  end if;
  update sadooh_private.pro_codes set redeemed_by=p_uid,redeemed_at=clock_timestamp() where hash=c.hash;
 elsif p_action<>'GET' then raise exception 'INVALID_ACTION'; end if;
 select * into a from sadooh_private.accounts where user_id=p_uid;
 month_key:=to_char(clock_timestamp() at time zone 'Asia/Riyadh','YYYY-MM');
 select count(*) into used from sadooh_private.host_rounds where host_id=p_uid and month=month_key;
 return jsonb_build_object('username',a.username,'isPro',a.permanent_pro or coalesce(a.pro_until>clock_timestamp(),false),'permanent',a.permanent_pro,'proUntil',a.pro_until,'isAdmin',is_admin,'used',used,'remaining',greatest(0,8-used),'month',month_key,'prefs',a.prefs,'enforced',(select enforced from sadooh_private.pro_config where id));
end $$;