import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrityDossierPdf } from "../src/server/integrityDossierPdf";

const base = {
  organization: "Empresa Piloto",
  protocol: "ORD-2026-001",
  status: "closed",
  category: "Assédio",
  severity: "high",
  priority: "urgent",
  unit: "Operações",
  committee: "Comitê de Ética",
  owner: "Responsável Compliance",
  collaborators: ["Investigador A"],
  createdAt: "2026-08-09T12:00:00.000Z",
  description: "Descrição original autorizada para o dossiê.",
  tasks: [{ title: "Entrevistar testemunha", status: "done", priority: "high", due_at: "2026-08-10T12:00:00.000Z" }],
  evidence: [{ name: "registro.pdf", mime: "application/pdf", size: 42, checksum: "a".repeat(64), created_at: "2026-08-09T13:00:00.000Z" }],
  timeline: [{ event_type: "decision_recorded", actor_name: "Compliance", created_at: "2026-08-09T14:00:00.000Z" }],
  recommendation: "Recomendação formal.", conclusion: "Conclusão interna.", measuresTaken: "Providências adotadas.", finalClassification: "Procedente", closureReason: "Apuração concluída.",
};

test("dossiê PDF é válido e omite identidade por padrão", () => {
  const pdf = createIntegrityDossierPdf({ ...base, reporterIdentity: null });
  const text = pdf.toString("latin1");
  assert.match(text,/^%PDF-1\.4/);
  assert.match(text,/Omitida nesta exportação/);
  assert.doesNotMatch(text,/segredo|secret_hash|signedUrl|bearer|token=/i);
  assert.match(text,/%%EOF/);
});

test("dossiê inclui identidade somente quando fornecida após autorização", () => {
  const pdf = createIntegrityDossierPdf({ ...base, reporterIdentity: { name:"Relatora Autorizada",email:"relatora@example.test",phone:"11999999999" } });
  const text = pdf.toString("latin1");
  assert.match(text,/Relatora Autorizada/);
  assert.match(text,/relatora@example\.test/);
  assert.doesNotMatch(text,/secret_hash|signedUrl|token=/i);
});
