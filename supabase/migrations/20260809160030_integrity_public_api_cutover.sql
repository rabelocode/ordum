-- Public submissions and tracking now cross the server-side API boundary.
-- Keep these SECURITY DEFINER functions callable only by the backend service role.
revoke execute on function public.get_integrity_channel(text) from public, anon, authenticated;
revoke execute on function public.get_integrity_form(text) from public, anon, authenticated;
revoke execute on function public.submit_integrity_report(text,text,text,date) from public, anon, authenticated;
revoke execute on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.read_integrity_report(text,text) from public, anon, authenticated;
revoke execute on function public.read_integrity_report_v2(text,text) from public, anon, authenticated;
revoke execute on function public.post_integrity_reporter_message(text,text,text) from public, anon, authenticated;

grant execute on function public.get_integrity_channel(text) to service_role;
grant execute on function public.get_integrity_form(text) to service_role;
grant execute on function public.submit_integrity_report(text,text,text,date) to service_role;
grant execute on function public.submit_integrity_report_v2(text,text,text,text,text,date,uuid,jsonb) to service_role;
grant execute on function public.read_integrity_report(text,text) to service_role;
grant execute on function public.read_integrity_report_v2(text,text) to service_role;
grant execute on function public.post_integrity_reporter_message(text,text,text) to service_role;
