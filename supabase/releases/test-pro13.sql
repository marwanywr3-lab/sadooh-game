begin;
insert into auth.users(id,email,is_anonymous,aud,role) values
('30000000-0000-4000-8000-000000000001','marmralibarbood@gmail.com',false,'authenticated','authenticated'),
('30000000-0000-4000-8000-000000000002','marbrahim.aljrbood@gmail.com',false,'authenticated','authenticated'),
('30000000-0000-4000-8000-000000000003','alshbabb33@gmail.com',false,'authenticated','authenticated');
set local role service_role;
do $$declare a jsonb;c jsonb;begin
 a:=public.sadooh_account('30000000-0000-4000-8000-000000000001');if not (a->>'isAdmin')::boolean then raise exception 'new admin not authorized';end if;
 c:=public.sadooh_account('30000000-0000-4000-8000-000000000001','ISSUE');if length(c->>'code')<>32 then raise exception 'admin cannot issue without additional code';end if;
 a:=public.sadooh_account('30000000-0000-4000-8000-000000000002');if not (a->>'permanent')::boolean or not (a->>'isPro')::boolean then raise exception 'new lifetime account not Pro';end if;
 a:=public.sadooh_account('30000000-0000-4000-8000-000000000003');if (a->>'permanent')::boolean or (a->>'isPro')::boolean or (a->>'isAdmin')::boolean then raise exception 'removed lifetime account still privileged';end if;
 a:=public.sadooh_account('30000000-0000-4000-8000-000000000002','SAVE_PREFS','{"background":"#c6e4f5","position":"top"}');
 a:=public.sadooh_account('30000000-0000-4000-8000-000000000002');if a->'prefs'->>'background'<>'#c6e4f5' or a->'prefs'->>'position'<>'top' then raise exception 'customization not persisted';end if;
 begin perform public.sadooh_admin_gate('30000000-0000-4000-8000-000000000001',gen_random_uuid());raise exception 'old code endpoint callable';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: new admin issues codes without extra verification, new permanent Pro, removed email loses permanent status, preferences save and reload, retired admin code endpoint disabled' as result;
rollback;
