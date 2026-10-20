-- All test fixtures and temporary enforcement are rolled back. No real accounts are modified.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous,aud,role) values
('10000000-0000-4000-8000-000000000001','pro-fixture@example.invalid',now(),false,'authenticated','authenticated'),
('10000000-0000-4000-8000-000000000002','sadoh.inquiries@gmail.com',now(),false,'authenticated','authenticated'),
('10000000-0000-4000-8000-000000000003','alshbab33@gmail.com',now(),false,'authenticated','authenticated'),
('10000000-0000-4000-8000-000000000004','alshbabb33@gmail.com',null,false,'authenticated','authenticated');
update sadooh_private.pro_config set enforced=true;
set local role service_role;
do $$
declare uid uuid:='10000000-0000-4000-8000-000000000001'; adm uuid:='10000000-0000-4000-8000-000000000002'; a jsonb; issued jsonb; err text; match uuid:=gen_random_uuid(); before_until timestamptz;
begin
 if not (public.sadooh_account('10000000-0000-4000-8000-000000000004')->>'permanent')::boolean then raise exception 'no-confirmation permanent failed';end if;
 a:=public.sadooh_account('10000000-0000-4000-8000-000000000003');if (a->>'permanent')::boolean then raise exception 'old email still permanent';end if;
 a:=public.sadooh_account(uid,'SAVE_NAME','{"username":"اختبار"}');if (a->>'isPro')::boolean or (a->>'isAdmin')::boolean then raise exception 'free privilege';end if;
 begin perform public.sadooh_account(uid,'ISSUE');raise exception 'nonadmin issued';exception when others then if sqlerrm<>'ADMIN_ONLY' then raise;end if;end;
 begin perform public.sadooh_account(uid,'SAVE_PREFS','{"background":"#000000","position":"top"}');raise exception 'free prefs';exception when others then if sqlerrm<>'PRO_REQUIRED' then raise;end if;end;
 perform public.sadooh_charge_round(uid,match);perform public.sadooh_charge_round(uid,match);
 for i in 1..7 loop perform public.sadooh_charge_round(uid,gen_random_uuid());end loop;
 a:=public.sadooh_account(uid);if (a->>'used')::integer<>8 then raise exception 'duplicate quota charge';end if;
 begin perform public.sadooh_charge_round(uid,gen_random_uuid());raise exception 'ninth allowed';exception when others then if sqlerrm<>'MONTHLY_LIMIT' then raise;end if;end;
 begin
  perform public.sadooh_commit(repeat('E',32),-1,jsonb_build_object('expires',extract(epoch from now()+interval '1 day')*1000,'room',jsonb_build_object('hostPlayerId',uid),'game',jsonb_build_object('matchId',gen_random_uuid())),'[]');
  raise exception 'quota bypass through commit';
 exception when others then if sqlerrm<>'MONTHLY_LIMIT' then raise;end if;end;
 if exists(select 1 from public.sadooh_rooms where code=repeat('E',32)) then raise exception 'failed start persisted';end if;
 issued:=public.sadooh_account(adm,'ISSUE');if length(issued->>'code')<>32 then raise exception 'bad code';end if;
 a:=public.sadooh_account(uid,'REDEEM',jsonb_build_object('code',issued->>'code'));if not (a->>'isPro')::boolean then raise exception 'redeem failed';end if;
 before_until:=(a->>'proUntil')::timestamptz;
 if before_until<clock_timestamp()+interval '27 days' then raise exception 'short month';end if;
 begin perform public.sadooh_account(adm,'REDEEM',jsonb_build_object('code',issued->>'code'));raise exception 'reuse allowed';exception when others then if sqlerrm<>'INVALID_CODE' then raise;end if;end;
 perform public.sadooh_charge_round(uid,gen_random_uuid());
 issued:=public.sadooh_account(adm,'ISSUE');a:=public.sadooh_account(uid,'REDEEM',jsonb_build_object('code',issued->>'code'));
 if (a->>'proUntil')::timestamptz<>before_until+interval '1 month' then raise exception 'extension failed';end if;
 a:=public.sadooh_account(uid,'SAVE_PREFS','{"background":"#123456","position":"top"}');if a->'prefs'->>'position'<>'top' then raise exception 'prefs not saved';end if;
 begin perform public.sadooh_account(uid,'SAVE_PREFS','{"background":"url(https://bad)","position":"fixed"}');raise exception 'css accepted';exception when others then if sqlerrm<>'INVALID_PREFS' then raise;end if;end;
end $$;
reset role;
-- Expired code and expired subscription checks.
update auth.users set email_confirmed_at=now() where id='10000000-0000-4000-8000-000000000004';
update sadooh_private.accounts set pro_until=now()-interval '1 day' where user_id='10000000-0000-4000-8000-000000000001';
insert into sadooh_private.pro_codes(hash,issuer,expires_at) values(encode(sha256(convert_to(repeat('A',32),'UTF8')),'hex'),'10000000-0000-4000-8000-000000000002',now()-interval '1 second');
set local role service_role;
do $$begin
 if not (public.sadooh_account('10000000-0000-4000-8000-000000000004')->>'permanent')::boolean then raise exception 'second permanent account failed';end if;
 if (public.sadooh_account('10000000-0000-4000-8000-000000000001')->>'isPro')::boolean then raise exception 'expiry bypass';end if;
 begin perform public.sadooh_account('10000000-0000-4000-8000-000000000001','REDEEM',jsonb_build_object('code',repeat('A',32)));raise exception 'expired accepted';exception when others then if sqlerrm<>'INVALID_CODE' then raise;end if;end;
end $$;
reset role;
set local role authenticated;
do $$begin
 begin perform public.sadooh_account('10000000-0000-4000-8000-000000000001');raise exception 'public rpc exposed';exception when insufficient_privilege then null;end;
 begin perform hash from sadooh_private.pro_codes;raise exception 'codes exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: no confirmation, corrected permanent email, permanent Pro, admin isolation, one-use and expired codes, month extension, 8-round quota and idempotency, expiry, preference validation, private schema and RPC access' as result;
rollback;
