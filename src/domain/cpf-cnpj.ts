/**
 * CPF / CNPJ — normalização, validação com dígitos verificadores e mascaramento.
 *
 * Usado no backend (billing router) e opcionalmente no frontend para feedback imediato.
 *
 * Regras:
 *   - CPF: 11 dígitos, módulo 11 nos dois últimos.
 *   - CNPJ: 14 dígitos, módulo 11 nos dois últimos com pesos específicos.
 *   - Sequências repetidas (111.111.111-11) são rejeitadas.
 */

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/** Remove tudo que não é dígito. */
export function normalizeTaxId(raw: string): string {
  return raw.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

export function validateCpf(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10) rem = 0;
  if (rem !== parseInt(digits[10], 10)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

export function validateCnpj(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * w1[i];
  let rem = sum % 11;
  const d1 = rem < 2 ? 0 : 11 - rem;
  if (d1 !== parseInt(digits[12], 10)) return false;

  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i], 10) * w2[i];
  rem = sum % 11;
  const d2 = rem < 2 ? 0 : 11 - rem;
  if (d2 !== parseInt(digits[13], 10)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Validação combinada
// ---------------------------------------------------------------------------

export function isValidTaxId(raw: string): boolean {
  const digits = normalizeTaxId(raw);
  if (digits.length === 11) return validateCpf(digits);
  if (digits.length === 14) return validateCnpj(digits);
  return false;
}

// ---------------------------------------------------------------------------
// Mascaramento para auditoria (nunca gravar CPF/CNPJ completo)
// ---------------------------------------------------------------------------

/** CPF: ***.***.XXX-XX | CNPJ: **.***.*** / XXXX-XX | fallback: ****XXXX */
export function maskTaxId(raw: string): string {
  const d = normalizeTaxId(raw);
  if (d.length === 11) return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `**.***.**/${d.slice(8, 12)}-${d.slice(12)}`;
  return `****${d.slice(-4)}`;
}

/** Retorna apenas os últimos 4 dígitos. */
export function taxIdLast4(raw: string): string {
  return normalizeTaxId(raw).slice(-4);
}
