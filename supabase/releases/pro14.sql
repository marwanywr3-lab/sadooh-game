create or replace function public.sadooh_account(p_uid uuid,p_action text default 'GET',p_value jsonb default '{}') returns jsonb language plpgsql set search_path='' as $$
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
  if coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'background','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'position','') not in ('top','bottom','left','right') then raise exception 'INVALID_PREFS'; end if;
  update sadooh_private.accounts set prefs=jsonb_build_object('background',p_value->>'background','position',p_value->>'position','badgeColor',coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f')) where user_id=p_uid;
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