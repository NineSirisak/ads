/**
 * MFA enforcement logic
 * ใช้ Supabase Auth MFA (aal1/aal2) — ฟังก์ชันนี้เป็น pure logic ที่ middleware เรียกใช้
 * เพื่อตัดสินว่า session ปัจจุบันต้อง challenge MFA เพิ่มก่อนเข้าถึง route หรือไม่
 */

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2';

export interface MfaCheckInput {
  currentAal: AuthenticatorAssuranceLevel;
  userRole: 'SuperAdmin' | 'Admin' | 'Driver';
  isMfaEnabledForUser: boolean;
  requestedPath: string;
}

const MFA_REQUIRED_ROLES: ReadonlySet<string> = new Set(['SuperAdmin', 'Admin']);
const MFA_PROTECTED_PATH_PREFIXES = ['/admin', '/superadmin'];

export function isProtectedPath(path: string): boolean {
  return MFA_PROTECTED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function requiresMfaChallenge(input: MfaCheckInput): boolean {
  const { currentAal, userRole, isMfaEnabledForUser, requestedPath } = input;

  if (!isProtectedPath(requestedPath)) return false;
  if (!MFA_REQUIRED_ROLES.has(userRole)) return false;
  if (!isMfaEnabledForUser) {
    // role ที่บังคับ MFA แต่ยังไม่ตั้งค่า -> ต้อง enroll ก่อน (ถือเป็น block เช่นกัน)
    return true;
  }
  return currentAal !== 'aal2';
}

/**
 * ตรวจสอบ backup code แบบ one-time use
 * รับ array ของ hash ที่ยังไม่ถูกใช้ + hash function สำหรับเทียบ (dependency injection เพื่อ testable)
 */
export function verifyBackupCode(
  inputCode: string,
  unusedHashes: string[],
  hashFn: (code: string) => string
): { valid: boolean; matchedHash?: string } {
  const inputHash = hashFn(inputCode.trim());
  const matchedHash = unusedHashes.find((h) => h === inputHash);
  return { valid: Boolean(matchedHash), matchedHash };
}
