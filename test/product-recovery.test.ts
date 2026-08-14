import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { userFacingApiError } from "../src/lib/userFacingError";

const read = (path:string) => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("camada de erros traduz falhas técnicas sem expor status HTTP",()=>{
  assert.equal(userFacingApiError({error:"proposal_invalid_transition"},409),"Esta proposta precisa ser aprovada antes de registrar o aceite.");
  assert.equal(userFacingApiError({error:"Forbidden"},403),"Seu perfil não permite realizar esta ação.");
  assert.equal(userFacingApiError({error:"database stack trace"},500),"Não foi possível concluir esta ação.");
});

test("navegação do Integridade apresenta áreas orientadas ao trabalho",()=>{
  const source=read("src/components/workspace/IntegrityModuleView.tsx");
  for(const label of ["Visão geral","Casos","Investigações","Relatórios","Configurações"]) assert.match(source,new RegExp(label));
  assert.doesNotMatch(source,/>Pendências</);
  assert.doesNotMatch(source,/>Implantação</);
});

test("caixa de casos possui visões rápidas, filtros recolhidos e lista mobile",()=>{
  const source=read("src/components/workspace/integrity/IntegrityCasesList.tsx");
  for(const label of ["Todos","Novos","Sem responsável","Meus casos","Aguardando resposta","SLA crítico","Encerrados"]) assert.match(source,new RegExp(label));
  assert.match(source,/md:hidden/);
  assert.match(source,/Filtros avançados/);
});

test("canal público conduz o relato em seis etapas e entrega comprovante seguro",()=>{
  const source=read("src/pages/public/IntegrityChannelPage.tsx");
  for(const label of ["Sobre o ocorrido","Pessoas e local","Detalhes","Evidências","Identificação","Revisão"]) assert.match(source,new RegExp(label));
  assert.match(source,/Copiar informações/);
  assert.match(source,/Baixar comprovante/);
  assert.match(source,/Seu relato/);
});

test("encerramento separa decisão interna da mensagem ao denunciante",()=>{
  const source=read("src/components/workspace/integrity/CaseDecision.tsx");
  assert.match(source,/Fundamentação interna/);
  assert.match(source,/Somente a equipe de Integridade verá este conteúdo/);
  assert.match(source,/Mensagem final ao denunciante/);
  assert.match(source,/Antes de encerrar, confirme/);
});

test("comunicação exige confirmação explícita antes de mensagem externa",()=>{
  const source=read("src/components/workspace/integrity/CaseMessages.tsx");
  assert.match(source,/Esta mensagem ficará visível no acompanhamento público/);
  assert.match(source,/Nota privada da equipe/);
  assert.match(source,/Confirmar envio/);
});

test("Admin oculta navegação técnica da operação comum",()=>{
  const source=read("src/pages/admin/OrdumAdminLayout.tsx");
  const nav=source.slice(source.indexOf("const allNavItems"),source.indexOf("const visibleNavItems"));
  assert.doesNotMatch(nav,/Deployments|Engenharia|Control plane/);
  for(const section of ["COMERCIAL","CLIENTES","FINANCEIRO","OPERAÇÃO","ADMINISTRAÇÃO"]) assert.match(nav,new RegExp(section));
});
