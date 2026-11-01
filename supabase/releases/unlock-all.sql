begin;
CREATE OR REPLACE FUNCTION public.sadooh_account(p_uid uuid, p_action text DEFAULT 'GET'::text, p_value jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  if coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'background','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(p_value->>'position','') not in ('top','bottom','left','right') then raise exception 'INVALID_PREFS'; end if;
  update sadooh_private.accounts set prefs=jsonb_build_object('background',p_value->>'background','position',p_value->>'position','badgeColor',coalesce(p_value->>'badgeColor',a.prefs->>'badgeColor','#f2d96f')) where user_id=p_uid;
 elsif p_action='ISSUE' then raise exception 'ADMIN_SEPARATE_SITE';
 elsif p_action='REDEEM' then raise exception 'SUBSCRIPTIONS_RETIRED';
 elsif p_action<>'GET' then raise exception 'INVALID_ACTION'; end if;
 select * into a from sadooh_private.accounts where user_id=p_uid;
 month_key:=to_char(clock_timestamp() at time zone 'Asia/Riyadh','YYYY-MM');
 select count(*) into used from sadooh_private.host_rounds where host_id=p_uid and month=month_key;
 return jsonb_build_object('username',a.username,'isPro',false,'permanent',false,'proUntil',null,'isAdmin',is_admin,'used',used,'remaining',null,'unlimited',true,'month',month_key,'prefs',a.prefs,'enforced',false);
end $function$;

update sadooh_private.pro_config set enforced=false where id=true;
commit;
