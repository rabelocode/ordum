type DossierLine = { text: string; bold?: boolean; size?: number; color?: string; gap?: number };

export type IntegrityDossier = {
  organization: string;
  protocol: string;
  status: string;
  category?: string | null;
  severity: string;
  priority: string;
  unit?: string | null;
  committee?: string | null;
  owner?: string | null;
  collaborators?: string[];
  createdAt: string;
  firstActionAt?: string | null;
  firstResponseDueAt?: string | null;
  treatmentDueAt?: string | null;
  closedAt?: string | null;
  subject?: string | null;
  description: string;
  tasks: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  recommendation?: string | null;
  conclusion?: string | null;
  measuresTaken?: string | null;
  finalClassification?: string | null;
  closureReason?: string | null;
  reporterIdentity?: { name?: string | null; email?: string | null; phone?: string | null } | null;
};

function latin(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function literal(value: string) {
  return latin(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function displayDate(value?: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function words(value: string, max = 90) {
  const paragraphs = latin(value).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!current) current = word;
      else if (`${current} ${word}`.length <= max) current += ` ${word}`;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function section(lines: DossierLine[], title: string, values: Array<[string, unknown]>) {
  lines.push({ text: title, bold: true, size: 12, color: "0.204 0.341 0.835", gap: 7 });
  for (const [label, value] of values) {
    const text = `${label}: ${value == null || value === "" ? "—" : String(value)}`;
    for (const [index, line] of words(text).entries())
      lines.push({ text: line, bold: index === 0, size: 9, gap: index === 0 ? 2 : 0 });
  }
  lines.push({ text: "", gap: 7 });
}

function buildLines(dossier: IntegrityDossier): DossierLine[] {
  const lines: DossierLine[] = [];
  section(lines, "Identificação do caso", [
    ["Organização", dossier.organization],
    ["Protocolo", dossier.protocol],
    ["Status", dossier.status],
    ["Categoria", dossier.category],
    ["Severidade", dossier.severity],
    ["Prioridade", dossier.priority],
    ["Unidade/setor", dossier.unit],
    ["Comitê", dossier.committee],
    ["Responsável principal", dossier.owner],
    ["Investigadores adicionais", dossier.collaborators?.join(", ") || "—"],
  ]);
  section(lines, "Datas e SLA", [
    ["Recebido em", displayDate(dossier.createdAt)],
    ["Primeira ação", displayDate(dossier.firstActionAt)],
    ["Primeira resposta até", displayDate(dossier.firstResponseDueAt)],
    ["Tratamento até", displayDate(dossier.treatmentDueAt)],
    ["Encerrado em", displayDate(dossier.closedAt)],
  ]);
  section(lines, "Denúncia original", [
    ["Assunto", dossier.subject],
    ["Descrição", dossier.description],
  ]);
  if (dossier.reporterIdentity) {
    section(lines, "Identidade autorizada do denunciante", [
      ["Nome", dossier.reporterIdentity.name],
      ["E-mail", dossier.reporterIdentity.email],
      ["Telefone", dossier.reporterIdentity.phone],
    ]);
  } else {
    section(lines, "Identidade do denunciante", [["Tratamento", "Omitida nesta exportação"]]);
  }
  section(lines, "Tarefas relevantes", dossier.tasks.length
    ? dossier.tasks.map((task) => [String(task.title || "Tarefa"), `${task.status || "—"} · ${task.priority || "—"} · prazo ${displayDate(task.due_at)}`])
    : [["Tarefas", "Nenhuma registrada"]]);
  section(lines, "Relação de evidências", dossier.evidence.length
    ? dossier.evidence.map((item) => [String(item.name || "Evidência"), `${item.mime || "—"} · ${item.size || 0} bytes · SHA-256 ${item.checksum || "não disponível"} · ${displayDate(item.created_at)}`])
    : [["Evidências", "Nenhuma registrada"]]);
  section(lines, "Decisão e encerramento", [
    ["Recomendação", dossier.recommendation],
    ["Classificação final", dossier.finalClassification],
    ["Conclusão", dossier.conclusion],
    ["Providências", dossier.measuresTaken],
    ["Motivo de encerramento", dossier.closureReason],
  ]);
  section(lines, "Timeline auditável", dossier.timeline.length
    ? dossier.timeline.map((event) => [displayDate(event.created_at), `${event.actor_name || "Sistema Ordum"} · ${event.event_type || "evento"}${event.note ? ` · ${event.note}` : ""}`])
    : [["Timeline", "Nenhum evento registrado"]]);
  return lines;
}

function pageStream(lines: DossierLine[], page: number, total: number) {
  const commands = [
    "0.125 0.137 0.133 rg 0 792 595 50 re f",
    "0.82 0.52 0.25 rg 0 786 595 6 re f",
    "BT /F2 16 Tf 1 1 1 rg 42 812 Td (ORDUM INTEGRIDADE) Tj ET",
    `BT /F1 8 Tf 0.35 0.38 0.37 rg 42 25 Td (Dossiê sanitizado · página ${page} de ${total}) Tj ET`,
  ];
  let y = 764;
  for (const line of lines) {
    y -= line.gap || 0;
    const size = line.size || 9;
    commands.push(`BT /${line.bold ? "F2" : "F1"} ${size} Tf ${line.color || "0.125 0.137 0.133"} rg 42 ${y} Td (${literal(line.text)}) Tj ET`);
    y -= Math.max(size + 4, 13);
  }
  return commands.join("\n");
}

export function createIntegrityDossierPdf(dossier: IntegrityDossier) {
  const logicalLines = buildLines(dossier);
  const pages: DossierLine[][] = [];
  let current: DossierLine[] = [];
  let used = 0;
  for (const line of logicalLines) {
    const height = Math.max((line.size || 9) + 4, 13) + (line.gap || 0);
    if (used + height > 705 && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(line);
    used += height;
  }
  if (current.length || !pages.length) pages.push(current);

  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const stream = pageStream(pageLines, index + 1, pages.length);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets = [0];
  let position = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = position;
    const chunk = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`, "latin1");
    chunks.push(chunk);
    position += chunk.length;
  }
  const xref = position;
  let trailer = `xref\n0 ${objects.length}\n0000000000 65535 f${" "}\n`;
  for (let id = 1; id < objects.length; id += 1)
    trailer += `${String(offsets[id]).padStart(10, "0")} 00000 n${" "}\n`;
  trailer += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(Buffer.from(trailer, "latin1"));
  return Buffer.concat(chunks);
}
