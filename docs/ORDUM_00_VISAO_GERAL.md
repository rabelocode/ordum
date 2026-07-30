# Visão Geral da Plataforma

A **Ordum** é uma plataforma de Soluções Corporativas com a assinatura *"A ordem que move empresas"*.

A arquitetura é modular, baseada no princípio de menor privilégio e isolamento por empresa (tenant). 

## Arquitetura de Acesso
- **Separação Estrutural:** Existe uma clara separação entre a HOME pública, o núcleo global, as soluções e a administração interna da Ordum.
- **Leads vs. Tenants:** Um lead (prospecto comercial) nunca deve criar automaticamente um tenant. O fluxo comercial exige aprovação explícita.
- **Isolamento por Empresa:** Os dados e as configurações organizacionais são totalmente isolados por tenant.

## Definições Obrigatórias das Soluções

### Ordum Integridade
Um canal **100% anônimo** de denúncias. 
- Registro de relatos sem necessidade de login.
- Acompanhamento por número de protocolo e senha/segredo.
- Comunicação anônima bidirecional.
- Gestão restrita dos casos (acesso explícito e auditável, compatível com gestão de conflitos de interesse).
*(Nota: não existe fluxo "anônimo ou identificado". É exclusivamente anônimo).*

### Ordum Pessoas
O Portal do Colaborador.
- Disponibiliza holerites, avisos e documentos.
- Permite solicitações (ex: férias, dúvidas).
- Permite agendar atendimento/reunião com o RH.
- Centraliza os serviços internos para o colaborador comum.

### Ordum Talentos
Solução para o processo de recrutamento e seleção.
- Permite publicar vagas.
- Recebimento de candidaturas e currículos.
- Aplicação de testes e organização do processo seletivo por etapas.
- Gestão de banco de talentos.

## Integração Supabase
A Ordum foi integrada ao Supabase de produção (Project Ref: plnciaxcujnvaermxmby).
- **Autenticação:** Utiliza Supabase Auth com Google OAuth para acesso corporativo.
- **Banco de Dados:** Utiliza PostgreSQL via PostgREST para dados relacionais (profiles, tenants, memberships, roles, permissions).
- **Isolamento e RLS:** O sistema delega o controle de acesso ao Row Level Security (RLS) do Supabase para garantir isolamento por tenant.
