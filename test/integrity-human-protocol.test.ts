import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  resolve(
    "supabase/migrations/20260814175716_integrity_human_protocol_random_source_fix.sql",
  ),
  "utf8",
);
const publicRouter = readFileSync(
  resolve("src/server/integrityPublicRouter.ts"),
  "utf8",
);
const publicPage = readFileSync(
  resolve("src/pages/public/IntegrityChannelPage.tsx"),
  "utf8",
);

describe("protocolo humano do Ordum Integridade", () => {
  it("gera INT-AAAA-000000 com ano de São Paulo e seis dígitos", () => {
    assert.match(migration, /v_protocol\s*:=\s*'INT-'/i);
    assert.match(migration, /timezone\('America\/Sao_Paulo',\s*now\(\)\)/i);
    assert.match(migration, /lpad\(v_random::text,\s*6,\s*'0'\)/i);
  });

  it("usa fonte criptográfica, não sequencial, com retry limitado de colisão", () => {
    assert.match(migration, /gen_random_bytes\(3\)/i);
    assert.match(migration, /for v_attempt in 1\.\.20 loop/i);
    assert.match(migration, /exception when unique_violation/i);
    assert.match(migration, /protocol_generation_failed/i);
    assert.doesNotMatch(migration, /nextval|sequence|row_number/i);
  });

  it("persiste o mesmo protocolo no relato e no caso", () => {
    assert.match(
      migration,
      /insert into public\.integrity_reports[\s\S]*?v_protocol[\s\S]*?returning id into v_report_id/i,
    );
    assert.match(
      migration,
      /insert into public\.integrity_cases[\s\S]*?values\([^;]*v_protocol/i,
    );
  });

  it("mantém segredo separado, aleatório e protegido com bcrypt", () => {
    assert.match(migration, /v_secret := encode\(gen_random_bytes\(24\),'hex'\)/i);
    assert.match(migration, /crypt\(v_secret,gen_salt\('bf'\)\)/i);
    assert.doesNotMatch(migration, /access_secret\s+text/i);
  });

  it("mantém a RPC privilegiada exclusiva de service_role", () => {
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path to 'pg_catalog', 'public', 'extensions'/i);
    assert.match(
      migration,
      /revoke all on function public\.submit_integrity_report_v2[\s\S]*from public, anon, authenticated/i,
    );
    assert.match(
      migration,
      /grant execute on function public\.submit_integrity_report_v2[\s\S]*to service_role/i,
    );
  });

  it("não restringe acompanhamento ao prefixo novo nem gera protocolo no browser", () => {
    assert.match(publicRouter, /protocol:\s*z\.string\(\)\.trim\(\)\.min\(8\)\.max\(64\)/);
    assert.doesNotMatch(publicRouter, /protocol.*startsWith\(["']INT-|protocol.*\^INT-/i);
    assert.match(publicPage, /result\.protocol/);
    assert.doesNotMatch(publicPage, /Math\.random|crypto\.randomUUID|ORD-/i);
  });
});
