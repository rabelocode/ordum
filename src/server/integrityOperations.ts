import express from "express";
import { timingSafeEqual } from "node:crypto";

const terminal = ["closed", "archived"];
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function runIntegrityOperations(db: any, now = new Date()) {
  const bucket = Math.floor(now.getTime() / 900_000);
  const runKey = `integrity-operations:${bucket}`;
  const claimed = await db.from("integrity_scheduler_runs").insert({ run_key: runKey, status: "running" }).select("id").maybeSingle();
  if (claimed.error?.code === "23505") return { idempotent: true, run_key: runKey, created: 0, retention_due: 0 };
  if (claimed.error) throw claimed.error;
  const stats = { created: 0, retention_due: 0, evaluated: 0 };
  try {
    const settings = await db.from("integrity_settings").select("tenant_id,alert_lead_hours,stale_case_hours");
    if (settings.error) throw settings.error;
    for (const setting of settings.data || []) {
      const cases = await db.from("integrity_cases").select("id,tenant_id,status,owner_membership_id,committee_id,updated_at,first_response_due_at,treatment_due_at,retention_due_at,retention_state").eq("tenant_id", setting.tenant_id);
      if (cases.error) throw cases.error;
      const memberships = await db.from("memberships").select("id,membership_roles(roles!inner(key))").eq("tenant_id",setting.tenant_id).eq("status","active");
      if (memberships.error) throw memberships.error;
      const committeeMembers = await db.from("integrity_committee_members").select("committee_id,membership_id").eq("active",true);
      if (committeeMembers.error) throw committeeMembers.error;
      const fallbackRecipients=(memberships.data||[]).filter((item:any)=>(item.membership_roles||[]).some((link:any)=>["tenant_admin","integrity_compliance"].includes(link.roles?.key))).map((item:any)=>item.id).slice(0,20);
      for (const item of cases.data || []) {
        stats.evaluated += 1;
        if (item.retention_state === "active" && item.retention_due_at && new Date(item.retention_due_at) <= now) {
          const updated=await db.from("integrity_cases").update({retention_state:"retention_due"}).eq("id",item.id).eq("retention_state","active");
          if(updated.error) throw updated.error; stats.retention_due += 1;
        }
        if (terminal.includes(item.status)) continue;
        const recipients = [...new Set([item.owner_membership_id, ...(committeeMembers.data||[]).filter((m:any)=>m.committee_id===item.committee_id).map((m:any)=>m.membership_id)].filter(Boolean))] as string[];
        const targets = recipients.length ? recipients : fallbackRecipients;
        const due = item.first_response_due_at || item.treatment_due_at;
        const events: Array<{type:string;title:string;key:string}> = [];
        if (!item.owner_membership_id && !item.committee_id) events.push({type:"case_unassigned",title:"Caso aguardando responsável",key:"unassigned"});
        if (due) {
          const delta = new Date(due).getTime()-now.getTime();
          if(delta<0) events.push({type:"sla_overdue",title:"Prazo de atendimento vencido",key:`sla-overdue:${due}`});
          else if(delta<=Number(setting.alert_lead_hours||24)*3_600_000) events.push({type:"sla_due_soon",title:"Prazo de atendimento próximo",key:`sla-soon:${due}`});
        }
        if(now.getTime()-new Date(item.updated_at).getTime()>=Number(setting.stale_case_hours||168)*3_600_000) events.push({type:"case_stale",title:"Caso sem movimentação",key:`stale:${new Date(item.updated_at).toISOString()}`});
        if(item.status==="decision") events.push({type:"decision_pending",title:"Decisão pendente",key:"decision"});
        if(item.retention_state==="retention_due") events.push({type:"retention_due",title:"Caso disponível para revisão de retenção",key:`retention:${item.retention_due_at}`});
        for(const event of events) for(const recipient of targets){
          const dedupe=`${event.key}:${item.id}:${recipient}`;
          const inserted=await db.from("integrity_notifications").upsert({tenant_id:item.tenant_id,recipient_membership_id:recipient,case_id:item.id,notification_type:event.type,title:event.title,dedupe_key:dedupe},{onConflict:"dedupe_key",ignoreDuplicates:true}).select("id").maybeSingle();
          if(inserted.error) throw inserted.error;
          if(inserted.data){ stats.created += 1; const out=await db.from("integrity_notification_outbox").insert({tenant_id:item.tenant_id,notification_id:inserted.data.id,case_id:item.id,recipient_membership_id:recipient,channel:"in_app",event_type:event.type,safe_subject:event.title,safe_preview:"Acesse o Ordum Integridade para consultar a pendência.",status:"delivered",dedupe_key:`in_app:${dedupe}`,delivered_at:now.toISOString()}); if(out.error&&out.error.code!=="23505")throw out.error; }
        }
      }
      const caseIds=(cases.data||[]).map((item:any)=>item.id);
      const tasks=caseIds.length?await db.from("integrity_case_tasks").select("id,case_id,assignee_membership_id,due_at").in("case_id",caseIds).in("status",["open","in_progress"]).lt("due_at",now.toISOString()):{data:[],error:null};
      if(tasks.error) throw tasks.error;
      for(const task of tasks.data||[]){ if(!task.assignee_membership_id) continue; const item=(cases.data||[]).find((c:any)=>c.id===task.case_id); if(!item)continue; const key=`task-overdue:${task.id}:${task.due_at}:${task.assignee_membership_id}`; const inserted=await db.from("integrity_notifications").upsert({tenant_id:setting.tenant_id,recipient_membership_id:task.assignee_membership_id,case_id:task.case_id,notification_type:"task_overdue",title:"Tarefa de investigação vencida",dedupe_key:key},{onConflict:"dedupe_key",ignoreDuplicates:true}).select("id").maybeSingle(); if(inserted.error)throw inserted.error; if(inserted.data){stats.created+=1;const out=await db.from("integrity_notification_outbox").insert({tenant_id:setting.tenant_id,notification_id:inserted.data.id,case_id:task.case_id,recipient_membership_id:task.assignee_membership_id,channel:"in_app",event_type:"task_overdue",safe_subject:"Tarefa de investigação vencida",safe_preview:"Acesse o Ordum Integridade para consultar a pendência.",status:"delivered",dedupe_key:`in_app:${key}`,delivered_at:now.toISOString()});if(out.error&&out.error.code!=="23505")throw out.error;} }
    }
    await db.from("integrity_scheduler_runs").update({status:"completed",stats,finished_at:new Date().toISOString()}).eq("id",claimed.data.id);
    return { idempotent:false,run_key:runKey,...stats };
  } catch(error) {
    await db.from("integrity_scheduler_runs").update({status:"failed",stats,finished_at:new Date().toISOString()}).eq("id",claimed.data.id);
    throw error;
  }
}

export function createIntegrityInternalRouter(getSupabaseAdmin:()=>any){
  const router=express.Router();
  router.get("/run",async(req,res,next)=>{try{
    const expected=process.env.CRON_SECRET||""; const provided=String(req.header("authorization")||"").replace(/^Bearer\s+/i,"");
    if(!expected||!safeEqual(expected,provided))return res.status(401).json({error:"Unauthorized"});
    const result=await runIntegrityOperations(getSupabaseAdmin()); return res.json(result);
  }catch(error){next(error);}});
  return router;
}
