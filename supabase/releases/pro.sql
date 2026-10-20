-- Additive Pro objects. Keep enforcement off until production email delivery is ready.
create table sadooh_private.pro_config(id boolean primary key default true check(id), enforced boolean not null default false);
insert into sadooh_private.pro_config values(true,false);
create table sadooh_private.accounts(user_id uuid primary key references auth.users(id),username text not null default '' check(length(username)<=24),pro_until timestamptz,prefs jsonb not null default '{}');
create table sadooh_private.pro_codes(hash text primary key,issuer uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,redeemed_by uuid references auth.users(id),redeemed_at timestamptz);
create table sadooh_private.host_rounds(match_id uuid primary key,host_id uuid not null references auth.users(id),month text not null,created_at timestamptz not null default clock_timestamp());
create index host_rounds_month_idx on sadooh_private.host_rounds(host_id,month);
alter table sadooh_private.pro_config enable row level security;
alter table sadooh_private.accounts enable row level security;
alter table sadooh_private.pro_codes enable row level security;
alter table sadooh_private.host_rounds enable row level security;
revoke all on sadooh_private.pro_config,sadooh_private.accounts,sadooh_private.pro_codes,sadooh_private.host_rounds from public,anon,authenticated;
grant all on sadooh_private.pro_config,sadooh_private.accounts,sadooh_private.pro_codes,sadooh_private.host_rounds to service_role;

create function public.sadooh_pro_enabled() returns boolean language sql set search_path='' as $$select enforced from sadooh_private.pro_config where id$$;
create function sadooh_private.account_identity(p_uid uuid) returns table(id uuid,email text,email_confirmed_at timestamptz,is_anonymous boolean) language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true)<>'service_role' and auth.uid() is distinct from p_uid then raise exception 'FORBIDDEN'; end if;
 return query select u.id,u.email::text,u.email_confirmed_at,u.is_anonymous from auth.users u where u.id=p_uid;
end $$;
revoke all on function sadooh_private.account_identity(uuid) from public,anon,authenticated;
grant execute on function sadooh_private.account_identity(uuid) to service_role;
create function public.sadooh_account(p_uid uuid,p_action text default 'GET',p_value jsonb default '{}') returns jsonb language plpgsql set search_path='' as $$
declare u record; a sadooh_private.accounts; permanent boolean; is_admin boolean; pro boolean; used integer; c sadooh_private.pro_codes; code text; expiry timestamptz; month_key text;
begin
 select * into u from sadooh_private.account_identity(p_uid);
 if u.id is null or u.is_anonymous or u.email is null then raise exception 'CONFIRM_EMAIL'; end if;
 permanent:=lower(u.email) in ('barboodmarwan@gmail.com','marbrahim.aljrbood@gmail.com');
 is_admin:=lower(u.email)='marmralibarbood@gmail.com';
 insert into sadooh_private.accounts(user_id) values(p_uid) on conflict do nothing;
 select * into a from sadooh_private.accounts where user_id=p_uid for update;
 pro:=permanent or a.pro_until>clock_timestamp(); pro:=coalesce(pro,false);
 if p_action='SAVE_NAME' then
  if length(trim(p_value->>'username')) not between 1 and 24 or p_value->>'username' ~ '[<>[:cntrl:]]' then raise exception 'INVALID_NAME'; end if;
  update sadooh_private.accounts set username=trim(p_value->>'username') where user_id=p_uid;
 elsif p_action='SAVE_PREFS' then
  if not pro then raise exception 'PRO_REQUIRED'; end if;
  if coalesce(p_value->>'background','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'position','') not in ('top','bottom','left','right') then raise exception 'INVALID_PREFS'; end if;
  update sadooh_private.accounts set prefs=jsonb_build_object('background',p_value->>'background','position',p_value->>'position') where user_id=p_uid;
 elsif p_action='ISSUE' then
  if not is_admin then raise exception 'ADMIN_ONLY'; end if;
  code:=upper(replace(gen_random_uuid()::text,'-',''));
  expiry:=clock_timestamp()+interval '10 minutes';
  insert into sadooh_private.pro_codes(hash,issuer,expires_at) values(encode(sha256(convert_to(code,'UTF8')),'hex'),p_uid,expiry);
  return jsonb_build_object('code',code,'expiresAt',expiry);
 elsif p_action='REDEEM' then
  code:=upper(regexp_replace(coalesce(p_value->>'code',''),'[ -]','','g'));
  if code !~ '^[A-F0-9]{32}$' then raise exception 'INVALID_CODE'; end if;
  select * into c from sadooh_private.pro_codes where hash=encode(sha256(convert_to(code,'UTF8')),'hex') for update;
  if c.hash is null or c.expires_at<=clock_timestamp() or c.redeemed_by is not null then raise exception 'INVALID_CODE'; end if;
  update sadooh_private.accounts set pro_until=greatest(coalesce(pro_until,clock_timestamp()),clock_timestamp())+interval '1 month' where user_id=p_uid;
  update sadooh_private.pro_codes set redeemed_by=p_uid,redeemed_at=clock_timestamp() where hash=c.hash;
 elsif p_action<>'GET' then raise exception 'INVALID_ACTION'; end if;
 select * into a from sadooh_private.accounts where user_id=p_uid;
 month_key:=to_char(clock_timestamp() at time zone 'Asia/Riyadh','YYYY-MM');
 select count(*) into used from sadooh_private.host_rounds where host_id=p_uid and month=month_key;
 return jsonb_build_object('username',a.username,'isPro',permanent or coalesce(a.pro_until>clock_timestamp(),false),'permanent',permanent,'proUntil',a.pro_until,'isAdmin',is_admin,'used',used,'remaining',greatest(0,8-used),'month',month_key,'prefs',a.prefs,'enforced',(select enforced from sadooh_private.pro_config where id));
end $$;

create function public.sadooh_charge_round(p_uid uuid,p_match uuid) returns void language plpgsql set search_path='' as $$
declare account jsonb;
begin
 if not public.sadooh_pro_enabled() then return; end if;
 -- Account lock serializes starts across different rooms for the same host.
 account:=public.sadooh_account(p_uid);
 if coalesce(account->>'username','')='' then raise exception 'USERNAME_REQUIRED'; end if;
 if exists(select 1 from sadooh_private.host_rounds where match_id=p_match) then return; end if;
 if not (account->>'isPro')::boolean and (account->>'used')::integer>=8 then raise exception 'MONTHLY_LIMIT'; end if;
 insert into sadooh_private.host_rounds(match_id,host_id,month) values(p_match,p_uid,account->>'month');
end $$;
revoke all on function public.sadooh_pro_enabled(),public.sadooh_account(uuid,text,jsonb),public.sadooh_charge_round(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sadooh_pro_enabled(),public.sadooh_account(uuid,text,jsonb),public.sadooh_charge_round(uuid,uuid) to service_role;
