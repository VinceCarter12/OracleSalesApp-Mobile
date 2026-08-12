import type { UserRole } from '../types';

/** The directory RPC and its local mirror are visible only to Sales/RSR. */
export function canReadManagerDirectory(role: UserRole | null): boolean {
  return role === 'sales_specialist' || role === 'rsr';
}
