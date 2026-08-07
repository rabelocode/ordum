-- Migration: Backfill commercial_proposal_items e commercial_contract_items
-- para propostas/contratos cujo plano possui soluções mas que estão sem itens.
--
-- Idempotente: usa WHERE NOT EXISTS / ON CONFLICT DO NOTHING.
-- Não usa IDs hardcoded.
-- unit_amount_cents = 0 (o valor total fica em commercial_proposals.amount_cents).

DO $$
DECLARE
  v_proposal_items_inserted int := 0;
  v_contract_items_inserted int := 0;
  v_proposals_repaired int := 0;
  v_contracts_repaired int := 0;
BEGIN

  -- ──────────────────────────────────────────────────────────────────────────
  -- Passo 1: Propostas sem itens cujo plano possui soluções
  -- ──────────────────────────────────────────────────────────────────────────
  WITH inserted AS (
    INSERT INTO public.commercial_proposal_items
      (proposal_id, solution_id, description, quantity, unit_amount_cents, limits)
    SELECT
      p.id,
      bps.solution_id,
      coalesce(s.name, 'Módulo'),
      1,
      0,
      bps.limits
    FROM public.commercial_proposals p
    JOIN public.billing_plan_solutions bps ON bps.plan_id = p.plan_id
    JOIN public.solutions s ON s.id = bps.solution_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.commercial_proposal_items pi
      WHERE pi.proposal_id = p.id
        AND pi.solution_id = bps.solution_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.commercial_proposal_items pi2
      WHERE pi2.proposal_id = p.id
    )
    RETURNING proposal_id
  )
  SELECT
    count(*),
    count(DISTINCT proposal_id)
  INTO v_proposal_items_inserted, v_proposals_repaired
  FROM inserted;

  -- ──────────────────────────────────────────────────────────────────────────
  -- Passo 2: Contratos sem itens (copiar da proposta)
  -- ──────────────────────────────────────────────────────────────────────────
  WITH inserted AS (
    INSERT INTO public.commercial_contract_items
      (contract_id, solution_id, description, quantity, unit_amount_cents, limits)
    SELECT
      c.id,
      pi.solution_id,
      pi.description,
      pi.quantity,
      pi.unit_amount_cents,
      pi.limits
    FROM public.commercial_contracts c
    JOIN public.commercial_proposal_items pi ON pi.proposal_id = c.proposal_id
    WHERE c.proposal_id IS NOT NULL
      AND pi.solution_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.commercial_contract_items ci
        WHERE ci.contract_id = c.id
      )
    ON CONFLICT (contract_id, solution_id) DO NOTHING
    RETURNING contract_id
  )
  SELECT
    count(*),
    count(DISTINCT contract_id)
  INTO v_contract_items_inserted, v_contracts_repaired
  FROM inserted;

  -- ──────────────────────────────────────────────────────────────────────────
  -- Passo 3: Relatório
  -- ──────────────────────────────────────────────────────────────────────────
  RAISE NOTICE 'Backfill concluído:';
  RAISE NOTICE '  Propostas reparadas: %  (% itens inseridos)', v_proposals_repaired, v_proposal_items_inserted;
  RAISE NOTICE '  Contratos reparados: %  (% itens inseridos)', v_contracts_repaired, v_contract_items_inserted;

END $$;
