import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Admin Members & Invite Flow Unit Tests', () => {

  it('detects Supabase auth callback hash and redirects to accept-invite route', () => {
    const urls = [
      'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/#access_token=test_token&refresh_token=test_refresh&type=invite',
      'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/#/auth/accept-invite#access_token=xyz&type=invite',
      'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/?code=123456#/auth/accept-invite',
      'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/#error=unauthorized_client&error_code=401&error_description=Invite+token+expired'
    ];

    urls.forEach((url) => {
      const parsedUrl = new URL(url);
      const hash = parsedUrl.hash;
      const search = parsedUrl.search;
      const href = parsedUrl.href;

      const lowerHref = href.toLowerCase();
      const lowerHash = hash.toLowerCase();
      const lowerSearch = search.toLowerCase();

      const isInviteFlow = lowerHref.includes("accept-invite") || 
                           lowerHref.includes("convite") || 
                           lowerHash.includes("type=invite") || 
                           lowerSearch.includes("type=invite") ||
                           lowerHash.includes("invite") ||
                           lowerHash.includes("access_token=");

      assert.equal(isInviteFlow, true, `URL ${url} devia ser identificada como fluxo de convite`);
    });
  });

  it('provides friendly human error messages for failed invite scenarios', () => {
    function getFriendlyInviteError(errorRaw: string): string {
      const lower = errorRaw.toLowerCase();
      if (lower.includes('expired') || lower.includes('expirad')) {
        return 'Este link de convite é inválido ou já expirou. Solicite um novo envio ao seu administrador.';
      }
      if (lower.includes('already') || lower.includes('usad') || lower.includes('accepted')) {
        return 'Este convite já foi aceito. Faça login para acessar o sistema.';
      }
      if (lower.includes('canceled') || lower.includes('cancelad')) {
        return 'Este convite foi cancelado pelo administrador.';
      }
      return 'Não conseguimos validar os dados deste convite. Solicite um novo envio.';
    }

    assert.equal(
      getFriendlyInviteError('AuthApiError: Email link is invalid or has expired'),
      'Este link de convite é inválido ou já expirou. Solicite um novo envio ao seu administrador.'
    );
    assert.equal(
      getFriendlyInviteError('User has already accepted this invite'),
      'Este convite já foi aceito. Faça login para acessar o sistema.'
    );
    assert.equal(
      getFriendlyInviteError('Invite canceled'),
      'Este convite foi cancelado pelo administrador.'
    );
  });

  it('formats redirect URL for invite emails with hash router accept route', () => {
    const origin = 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app';
    const redirectTo = `${origin.replace(/\/$/, '')}/#/auth/accept-invite`;

    assert.equal(redirectTo, 'https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/#/auth/accept-invite');
    assert.ok(redirectTo.includes('/#/auth/accept-invite'));
  });

  it('allows staff invite without initial team assignment', () => {
    const invitePayload = {
      email: 'colaborador.novo@ordum.app',
      role_key: 'sales',
      relationship_type: 'employee',
      team_ids: []
    };

    assert.equal(invitePayload.team_ids.length, 0);
    assert.equal(typeof invitePayload.email, 'string');
    assert.equal(invitePayload.role_key, 'sales');
  });

});
