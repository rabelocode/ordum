# Modelo de Dados (Preparação)

Este documento define os contratos e tipos preparados para implementação futura com banco de dados real.

## Convenções Globais
- **IDs:** Uso de UUID v4.
- **Isolamento:** Toda tabela base (exceto sistema) deve possuir `tenant_id` não nulo.
- **Rastreabilidade:** Colunas obrigatórias `created_at`, `updated_at`, `created_by`, `updated_by`.
- **Soft Delete:** Exclusão lógica através de `deleted_at`.
- **Histórico:** Uso de tabelas complementares `*_history` para transição de status.
- **Políticas:** RLS (Row Level Security) será utilizado quando houver SGBD real.

## Core / Global
- `tenants`, `tenant_domains`, `tenant_solutions`
- `users`, `user_identities`, `memberships`
- `organizational_units`, `departments`, `positions`
- `roles`, `permissions`, `role_permissions`, `membership_roles`
- `access_scopes`, `user_preferences`, `invitations`
- `files`, `file_links`, `notifications`, `audit_logs`

## Ordum Integridade
- `integrity_channels`, `integrity_report_categories`
- `integrity_reports` (Não deve possuir `user_id` vinculado na submissão, fluxo anônimo estrito)
- `integrity_protocol_secrets` (Segredo com hash)
- `integrity_report_messages`, `integrity_attachments`
- `integrity_case_assignments`, `integrity_case_actions`
- `integrity_status_history`, `integrity_indicators`

## Ordum Pessoas
- `people_employee_profiles`
- `people_payslips`
- `people_communications`, `people_communication_reads`
- `people_documents`, `people_document_acknowledgements`
- `people_request_types`, `people_requests`, `people_request_events`
- `people_hr_meetings`, `people_meeting_participants`

## Ordum Talentos
- `talent_career_sites`, `talent_jobs`, `talent_job_stages`
- `talent_candidates`
- `talent_applications`, `talent_resumes`
- `talent_assessment_templates`, `talent_assessments`, `talent_assessment_responses`
- `talent_stage_history`, `talent_interviews`, `talent_feedback`
- `talent_pool_memberships`

## Comercial e HOME
- `marketing_leads`, `lead_status_history`, `lead_events`
- `marketing_consents`, `site_content_versions`

## Tabelas no Supabase (Produção)
A aplicação está conectada ao Supabase com o seguinte mapa de tabelas real:
- `profiles`
- `tenants`
- `memberships`
- `departments`
- `positions`
- `tenant_domains`
- `solutions`
- `tenant_solutions`
- `roles`
- `membership_roles`
- `permissions`
- `role_permissions`
- `marketing_leads`

## RPCs Públicas
- `submit_marketing_lead`
- `get_integrity_form`
- `submit_integrity_report`
- `read_integrity_report`
- `post_integrity_reporter_message`
- `submit_talent_application`

*A chave `SUPABASE_SECRET_KEY` é de uso estrito server-side e não consta no front-end.*
