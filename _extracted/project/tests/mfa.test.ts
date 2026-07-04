import { describe, it, expect } from 'vitest';
import { isProtectedPath, requiresMfaChallenge, verifyBackupCode } from '@/lib/mfa';
import crypto from 'crypto';

describe('isProtectedPath', () => {
  it('flags /admin/* as protected', () => {
    expect(isProtectedPath('/admin/finance')).toBe(true);
  });
  it('flags /superadmin/* as protected', () => {
    expect(isProtectedPath('/superadmin/analytics')).toBe(true);
  });
  it('does not flag driver PWA routes', () => {
    expect(isProtectedPath('/driver/checkin')).toBe(false);
  });
});

describe('requiresMfaChallenge', () => {
  it('does not require MFA for Driver role even on protected path (drivers never hit admin routes)', () => {
    const result = requiresMfaChallenge({
      currentAal: 'aal1',
      userRole: 'Driver',
      isMfaEnabledForUser: false,
      requestedPath: '/admin/finance',
    });
    expect(result).toBe(false);
  });

  it('requires MFA enrollment for Admin who has not set it up yet', () => {
    const result = requiresMfaChallenge({
      currentAal: 'aal1',
      userRole: 'Admin',
      isMfaEnabledForUser: false,
      requestedPath: '/admin/finance',
    });
    expect(result).toBe(true);
  });

  it('requires challenge for SuperAdmin with MFA enabled but session still aal1', () => {
    const result = requiresMfaChallenge({
      currentAal: 'aal1',
      userRole: 'SuperAdmin',
      isMfaEnabledForUser: true,
      requestedPath: '/superadmin/analytics',
    });
    expect(result).toBe(true);
  });

  it('does not require challenge once session is aal2', () => {
    const result = requiresMfaChallenge({
      currentAal: 'aal2',
      userRole: 'SuperAdmin',
      isMfaEnabledForUser: true,
      requestedPath: '/superadmin/analytics',
    });
    expect(result).toBe(false);
  });

  it('does not require MFA for non-protected paths regardless of role', () => {
    const result = requiresMfaChallenge({
      currentAal: 'aal1',
      userRole: 'Admin',
      isMfaEnabledForUser: false,
      requestedPath: '/dashboard',
    });
    expect(result).toBe(false);
  });
});

describe('verifyBackupCode', () => {
  const hashFn = (code: string) => crypto.createHash('sha256').update(code).digest('hex');

  it('validates a matching backup code', () => {
    const codes = ['ABC123', 'DEF456'].map(hashFn);
    const result = verifyBackupCode('ABC123', codes, hashFn);
    expect(result.valid).toBe(true);
  });

  it('rejects a non-matching code', () => {
    const codes = ['ABC123'].map(hashFn);
    const result = verifyBackupCode('WRONG1', codes, hashFn);
    expect(result.valid).toBe(false);
  });

  it('trims whitespace before hashing', () => {
    const codes = ['ABC123'].map(hashFn);
    const result = verifyBackupCode('  ABC123  ', codes, hashFn);
    expect(result.valid).toBe(true);
  });
});
