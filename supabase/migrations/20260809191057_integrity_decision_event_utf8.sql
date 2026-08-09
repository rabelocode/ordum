begin;

create or replace function public.decide_and_close_integrity_case(
  p_case_id uuid,p_tenant_id uuid,p_actor_membership_id uuid,p_final_classification text,
  p_conclusion text,p_measures_taken text,p_internal_justification text,p_reporter_outcome text,p_expected_lock_version integer
) returns table(status text,lock_version integer) language plpgsql security definer set search_path=public,pg_temp as $$
declare v_case public.integrity_cases%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if not exists(select 1 from public.memberships m where m.id=p_actor_membership_id and m.tenant_id=p_tenant_id and m.status='active') then raise exception 'actor_not_authorized' using errcode='42501'; end if;
  select * into v_case from public.integrity_cases where id=p_case_id and tenant_id=p_tenant_id for update;
  if not found then raise exception 'case_not_found' using errcode='P0002'; end if;
  if v_case.lock_version<>p_expected_lock_version then raise exception 'case_version_conflict' using errcode='40001'; end if;
  if v_case.status<>'decision' then raise exception 'case_not_ready_for_decision' using errcode='22023'; end if;
  if least(length(trim(p_final_classification)),length(trim(p_conclusion)),length(trim(p_measures_taken)),length(trim(p_internal_justification)))<3 then raise exception 'decision_fields_required' using errcode='22023'; end if;
  update public.integrity_cases c set status='closed',final_classification=trim(p_final_classification),conclusion=trim(p_conclusion),measures_taken=trim(p_measures_taken),internal_justification=trim(p_internal_justification),reporter_outcome=nullif(trim(coalesce(p_reporter_outcome,'')),''),decided_at=v_now,decided_by_membership_id=p_actor_membership_id,closed_at=v_now,closure_reason=trim(p_internal_justification),lock_version=c.lock_version+1,updated_at=v_now where c.id=p_case_id returning c.status,c.lock_version into status,lock_version;
  insert into public.integrity_case_events(report_id,case_id,event_type,from_status,to_status,note,actor_membership_id,metadata) values(v_case.report_id,p_case_id,'decision_recorded',v_case.status,'closed','Decisão interna registrada.',p_actor_membership_id,jsonb_build_object('final_classification',trim(p_final_classification)));
  if nullif(trim(coalesce(p_reporter_outcome,'')),'') is not null then insert into public.integrity_report_messages(report_id,author_type,body,visible_to_reporter,author_membership_id) values(v_case.report_id,'case_manager',trim(p_reporter_outcome),true,p_actor_membership_id); end if;
  return next;
end $$;

revoke all on function public.decide_and_close_integrity_case(uuid,uuid,uuid,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.decide_and_close_integrity_case(uuid,uuid,uuid,text,text,text,text,text,integer) to service_role;

commit;
