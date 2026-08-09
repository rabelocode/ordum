import assert from "node:assert/strict";
import test from "node:test";
import { integrityDeploymentState, publicIntegrityStatus, routingExplanation, validateIntegrityCustomValues } from "../src/domain/integrity-phase4g";
import { createIntegrityExecutivePdf } from "../src/server/integrityExecutivePdf";

const fields:any[]=[
  {id:"1",field_key:"local",label:"Local",field_type:"short_text",required:true},
  {id:"2",field_key:"envolvidos",label:"Envolvidos",field_type:"multi_select",required:false,options:["Gestor","Colega"]},
  {id:"3",field_key:"data_confirmada",label:"Data confirmada",field_type:"boolean",required:false},
];
test("campos públicos tipados aceitam apenas definição do tenant",()=>{const result=validateIntegrityCustomValues(fields,{local:"Matriz",envolvidos:["Gestor"],data_confirmada:true});assert.equal(result.valid,true);if(result.valid){assert.equal(result.rows.length,3);assert.deepEqual(result.rows[1].text_array_value,["Gestor"]);}});
test("campos públicos rejeitam ausente, opção inválida e campo desconhecido",()=>{assert.equal(validateIntegrityCustomValues(fields,{}).valid,false);assert.equal(validateIntegrityCustomValues(fields,{local:"Matriz",envolvidos:["Outro"]}).valid,false);assert.equal(validateIntegrityCustomValues(fields,{local:"Matriz",segredo:"não permitido"}).valid,false);});
test("status público é sanitizado e não revela workflow interno",()=>{assert.equal(publicIntegrityStatus("investigation"),"Em análise");assert.equal(publicIntegrityStatus("decision"),"Em análise final");assert.equal(publicIntegrityStatus("unknown_internal"),"Em análise");});
test("estado do wizard progride sem checklist paralelo",()=>{assert.equal(integrityDeploymentState([]),"not_started");assert.equal(integrityDeploymentState([{key:"channel",complete:true}]),"incomplete");assert.equal(integrityDeploymentState(["channel","categories","committee","routing","sla"].map(key=>({key,complete:true}))),"ready_for_test");assert.equal(integrityDeploymentState([{key:"published",complete:true}]),"published");});
test("explicação do routing permanece transparente",()=>{const text=routingExplanation({category_id:"cat",department_id:"dep",reporter_mode:"anonymous",committee_id:"com",target_priority:"urgent",target_sla_hours:24},{cat:"Assédio",dep:"Operações"});assert.match(text,/Assédio/);assert.match(text,/Operações/);assert.match(text,/anônimo/);assert.match(text,/prioridade urgent/);assert.match(text,/24h/);});
test("relatório executivo PDF é agregado e sanitizado",()=>{const pdf=createIntegrityExecutivePdf({organization:"Empresa Piloto",period:"01/08 a 31/08",generatedAt:"09/08/2026",filters:["unidade: Matriz"],metrics:[{label:"Recebidas",value:3}],distributions:[{title:"Por categoria",rows:[{label:"Conduta",count:3}]}]});const text=pdf.toString("latin1");assert.match(text,/^%PDF-1\.4/);assert.match(text,/Recebidas: 3/);assert.match(text,/sem identidades, mensagens ou evidencias/);assert.doesNotMatch(text,/secret|signedUrl|token|denunciante@example/i);});
