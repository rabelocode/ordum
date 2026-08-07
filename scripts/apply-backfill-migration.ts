import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://plnciaxcujnvaermxmby.supabase.co';
const secret = process.env.SUPABASE_SECRET_KEY || '';

async function main() {
  if (!secret) {
    throw new Error('SUPABASE_SECRET_KEY precisa estar definida nas variáveis de ambiente.');
  }
  const db = createClient(url, secret);

  console.log('Executando backfill idempotente de itens comerciais...');

  // 1. Propostas sem itens cujo plano possui soluções
  const { data: proposals, error: propErr } = await db
    .from('commercial_proposals')
    .select('id, plan_id, amount_cents');

  if (propErr) {
    console.error('Erro ao listar propostas:', propErr);
    process.exit(1);
  }

  let repairedProposals = 0;
  let proposalItemsInserted = 0;

  for (const p of proposals || []) {
    if (!p.plan_id) continue;

    // Verificar se já possui itens
    const { count } = await db
      .from('commercial_proposal_items')
      .select('id', { count: 'exact', head: true })
      .eq('proposal_id', p.id);

    if ((count || 0) > 0) continue;

    // Buscar soluções do plano
    const { data: planSolutions } = await db
      .from('billing_plan_solutions')
      .select('solution_id, limits, solutions(name)')
      .eq('plan_id', p.plan_id);

    if (!planSolutions || planSolutions.length === 0) continue;

    // Inserir itens com unit_amount_cents = 0 (Requisito 8)
    const itemsToInsert = planSolutions.map((item: any) => ({
      proposal_id: p.id,
      solution_id: item.solution_id,
      description: item.solutions?.name || 'Módulo',
      quantity: 1,
      unit_amount_cents: 0,
      limits: item.limits || {},
    }));

    const { data: inserted, error: insertErr } = await db
      .from('commercial_proposal_items')
      .insert(itemsToInsert)
      .select();

    if (insertErr) {
      console.error(`Erro ao reparar proposta ${p.id}:`, insertErr.message);
    } else if (inserted && inserted.length > 0) {
      repairedProposals++;
      proposalItemsInserted += inserted.length;
    }
  }

  // 2. Contratos sem itens (copiar da proposta)
  const { data: contracts, error: cntErr } = await db
    .from('commercial_contracts')
    .select('id, proposal_id');

  if (cntErr) {
    console.error('Erro ao listar contratos:', cntErr);
    process.exit(1);
  }

  let repairedContracts = 0;
  let contractItemsInserted = 0;

  for (const c of contracts || []) {
    if (!c.proposal_id) continue;

    const { count } = await db
      .from('commercial_contract_items')
      .select('id', { count: 'exact', head: true })
      .eq('contract_id', c.id);

    if ((count || 0) > 0) continue;

    const { data: propItems } = await db
      .from('commercial_proposal_items')
      .select('*')
      .eq('proposal_id', c.proposal_id);

    if (!propItems || propItems.length === 0) continue;

    const itemsToInsert = propItems
      .filter((pi: any) => pi.solution_id)
      .map((pi: any) => ({
        contract_id: c.id,
        solution_id: pi.solution_id,
        description: pi.description,
        quantity: pi.quantity,
        unit_amount_cents: pi.unit_amount_cents,
        limits: pi.limits,
      }));

    if (itemsToInsert.length === 0) continue;

    const { data: inserted, error: insertErr } = await db
      .from('commercial_contract_items')
      .insert(itemsToInsert)
      .select();

    if (insertErr) {
      console.error(`Erro ao reparar contrato ${c.id}:`, insertErr.message);
    } else if (inserted && inserted.length > 0) {
      repairedContracts++;
      contractItemsInserted += inserted.length;
    }
  }

  console.log('--- RELATÓRIO DO BACKFILL DE ITENS COMERCIAIS ---');
  console.log(`Propostas reparadas: ${repairedProposals} (${proposalItemsInserted} itens inseridos)`);
  console.log(`Contratos reparados: ${repairedContracts} (${contractItemsInserted} itens inseridos)`);
}

main().catch(err => {
  console.error('Erro no script de backfill:', err);
  process.exit(1);
});
