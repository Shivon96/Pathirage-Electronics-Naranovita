/**
 * Security Rules Unit Spec (Emulator Verification Reference)
 * Verifies all Dirty Dozen attack payloads against firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  { name: 'Cross-tenant read blocked', path: 'users/uidA/tickets/t1', actor: 'uidB', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-tenant write blocked', path: 'users/uidA/inventory/i1', actor: 'uidB', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified email blocked', path: 'users/uidA/shopProfile/default', actor: 'uidA_unverified', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field injection blocked', path: 'users/uidA/tickets/t1', extraField: 'isAdminBypass', expected: 'PERMISSION_DENIED' },
  { name: 'OwnerUid spoofing blocked', path: 'users/uidA/inventory/i1', ownerUid: 'uidB', expected: 'PERMISSION_DENIED' },
  { name: 'Oversized ID poisoning blocked', path: `users/uidA/tickets/${'a'.repeat(200)}`, expected: 'PERMISSION_DENIED' },
  { name: 'Invalid character ID blocked', path: 'users/uidA/tickets/bad$id!', expected: 'PERMISSION_DENIED' },
  { name: 'Client timestamp forgery blocked', path: 'users/uidA/tickets/t1', updatedAt: '2020-01-01', expected: 'PERMISSION_DENIED' },
  { name: 'Blanket collection list by non-owner blocked', path: 'users/uidA/posSales', actor: 'uidB', expected: 'PERMISSION_DENIED' },
  { name: 'Invalid enum status blocked', path: 'users/uidA/tickets/t1', status: 'HackedStatus', expected: 'PERMISSION_DENIED' },
  { name: 'Oversized string DoW blocked', path: 'users/uidA/tickets/t1', faultDescriptionLen: 50000, expected: 'PERMISSION_DENIED' },
  { name: 'Immutable id/ownerUid mutation blocked', path: 'users/uidA/tickets/t1', mutateId: true, expected: 'PERMISSION_DENIED' },
] as const;
