import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCpf, validateCnpj, isValidTaxId, maskTaxId, normalizeTaxId } from '../../../src/domain/cpf-cnpj';

describe('CPF/CNPJ Domain Module', () => {
  it('normalizes tax id correctly', () => {
    assert.equal(normalizeTaxId('111.444.777-35'), '11144477735');
    assert.equal(normalizeTaxId('11.444.777/0001-61'), '11444777000161');
  });

  it('validates valid CPF digits', () => {
    assert.equal(validateCpf('11144477735'), true);
  });

  it('rejects invalid CPF digits and repeated digit sequences', () => {
    assert.equal(validateCpf('11111111111'), false);
    assert.equal(validateCpf('12345678900'), false);
    assert.equal(validateCpf('123456'), false);
  });

  it('validates valid CNPJ digits', () => {
    assert.equal(validateCnpj('11444777000161'), true);
  });

  it('rejects invalid CNPJ digits and repeated digit sequences', () => {
    assert.equal(validateCnpj('00000000000000'), false);
    assert.equal(validateCnpj('11444777000199'), false);
  });

  it('isValidTaxId handles both CPF and CNPJ with formatting', () => {
    assert.equal(isValidTaxId('111.444.777-35'), true);
    assert.equal(isValidTaxId('11.444.777/0001-61'), true);
    assert.equal(isValidTaxId('000.000.000-00'), false);
    assert.equal(isValidTaxId('123'), false);
  });

  it('masks tax id for audit privacy (never exposes full tax id)', () => {
    assert.equal(maskTaxId('11144477735'), '***.***.777-35');
    assert.equal(maskTaxId('11444777000161'), '**.***.**/0001-61');
  });
});
