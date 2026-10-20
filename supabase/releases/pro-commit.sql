CREATE OR REPLACE FUNCTION public.sadooh_commit(p_code text, p_revision bigint, p_state jsonb, p_views jsonb, p_report jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare changed integer; expiry timestamptz; item jsonb; previous_match text;
begin
 select state->'game'->>'matchId' into previous_match from public.sadooh_rooms where code=p_code for update;
 expiry=to_timestamp((p_state->>'expires')::double precision/1000);
 if p_revision=-1 then
   insert into public.sadooh_rooms(code,revision,state,expires_at) values(p_code,0,p_state,expiry) on conflict do nothing;
 else
   update public.sadooh_rooms set state=p_state,revision=p_revision+1,expires_at=expiry,updated_at=clock_timestamp()
   where code=p_code and revision=p_revision and expires_at>clock_timestamp();
 end if;
 get diagnostics changed=row_count;
 if changed=0 then return false; end if;
 if p_state->'game'->>'matchId' is not null and (p_state->'game'->>'matchId') is distinct from previous_match then
 perform public.sadooh_charge_round((p_state->'room'->>'hostPlayerId')::uuid,(p_state->'game'->>'matchId')::uuid);
 end if;
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
end $function$;

