import { useMemo, useState } from "react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Card, FilterSelect } from "./IntegrityUi";

export function CaseTasks({ tasks, members, templates, canManage, busy, onCreate, onUpdate }: { tasks:any[]; members:any[]; templates:any[]; canManage:boolean; busy:boolean; onCreate:(value:any,form:HTMLFormElement)=>Promise<void>; onUpdate:(id:string,value:any)=>Promise<void> }) {
  const [filter,setFilter] = useState("pending");
  const [editing,setEditing] = useState<string | null>(null);
  const taskTemplates = templates.filter((item) => item.template_type === "task" && item.active);
  const visible = useMemo(() => tasks.filter((task) => filter === "all" || (filter === "done" ? task.status === "done" : filter === "overdue" ? task.due_at && new Date(task.due_at) < new Date() && !["done","cancelled"].includes(task.status) : !["done","cancelled"].includes(task.status))),[tasks,filter]);
  return <Card title="Tarefas de investigação">
    {canManage ? <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onCreate({ title:form.get("title"),description:form.get("description") || null,due_at:form.get("due_at") ? new Date(String(form.get("due_at"))).toISOString() : null,priority:form.get("priority"),assignee_membership_id:form.get("assignee") || null,parent_task_id:form.get("parent_task") || null },event.currentTarget); }} className="grid gap-2 sm:grid-cols-2">
      <Input name="title" required minLength={2} placeholder="Título da nova tarefa" />
      <select name="template" className="rounded-xl border p-2 text-sm" onChange={(event) => { const template = taskTemplates.find((item) => item.id === event.target.value); const form = event.currentTarget.form; if (template && form) { (form.elements.namedItem("title") as HTMLInputElement).value = template.title || template.name; (form.elements.namedItem("description") as HTMLTextAreaElement).value = template.body; } }}><option value="">Aplicar template (opcional)</option>{taskTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <textarea name="description" maxLength={2000} rows={2} className="rounded-xl border p-3 sm:col-span-2" placeholder="Descrição e critério de conclusão" />
      <Input name="due_at" type="datetime-local" />
      <select name="priority" className="rounded-xl border p-2 text-sm"><option value="normal">Prioridade normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baixa</option></select>
      <select name="assignee" className="rounded-xl border p-2 text-sm"><option value="">Sem responsável</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
      <select name="parent_task" className="rounded-xl border p-2 text-sm"><option value="">Tarefa principal</option>{tasks.filter((task) => !task.parent_task_id).map((task) => <option key={task.id} value={task.id}>Subtarefa de: {task.title}</option>)}</select>
      <Button type="submit" disabled={busy}>Criar tarefa</Button>
    </form> : null}
    <div className="mt-4 flex justify-end"><FilterSelect label="Tarefas" value={filter} onChange={setFilter} includeEmpty={false} options={[["pending","Pendentes"],["overdue","Vencidas"],["done","Concluídas"],["all","Todas"]]} /></div>
    <div className="mt-3 space-y-2">{visible.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-500">Nenhuma tarefa neste filtro.</p> : visible.map((task) => {
      const overdue = task.due_at && new Date(task.due_at) < new Date() && !["done","cancelled"].includes(task.status);
      return <div key={task.id} className={`rounded-xl p-3 text-sm ${overdue ? "border border-red-200 bg-red-50" : "bg-[#F6F5F2]"}`}>
        {editing === task.id ? <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await onUpdate(task.id,{ title:form.get("title"),description:form.get("description") || null,due_at:form.get("due_at") ? new Date(String(form.get("due_at"))).toISOString() : null,priority:form.get("priority"),assignee_membership_id:form.get("assignee") || null,reason:form.get("reason") }); setEditing(null); }} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" defaultValue={task.title} required minLength={2} /><textarea name="description" defaultValue={task.description || ""} className="rounded-xl border p-2 sm:col-span-2" rows={2} />
          <Input name="due_at" type="datetime-local" defaultValue={task.due_at ? new Date(task.due_at).toISOString().slice(0,16) : ""} />
          <select name="priority" defaultValue={task.priority} className="rounded-xl border p-2"><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select>
          <select name="assignee" defaultValue={task.assignee_membership_id || ""} className="rounded-xl border p-2"><option value="">Sem responsável</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
          <Input name="reason" required minLength={3} placeholder="Motivo da alteração" /><div className="flex gap-2"><Button size="sm" disabled={busy}>Salvar</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div>
        </form> : <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{task.title}</strong>{task.description ? <p className="mt-1 text-gray-600">{task.description}</p> : null}<div className={overdue ? "font-bold text-red-700" : "text-gray-500"}>{task.due_at ? new Date(task.due_at).toLocaleString("pt-BR") : "Sem prazo"} · {task.priority} · {task.status}{task.parent_task_id ? " · subtarefa" : ""}</div><div className="text-xs text-gray-500">Responsável: {task.assignee_name || "Não atribuído"} · Criada por {task.creator_name || "Membro do tenant"}</div></div>{canManage ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(task.id)}>Editar</Button>{task.status === "done" ? <Button size="sm" variant="outline" onClick={() => onUpdate(task.id,{ status:"open",reason:"Tarefa reaberta para continuidade." })}>Reabrir</Button> : <Button size="sm" onClick={() => onUpdate(task.id,{ status:"done",reason:"Tarefa concluída." })}>Concluir</Button>}</div> : null}</div>}
      </div>;
    })}</div>
  </Card>;
}
