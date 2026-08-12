export type JointApprovalDisplay = 'Pending approval' | 'Approved' | 'Declined' | `Joint approval · ${number}/2 approved` | 'Joint approval · Approved' | 'Joint approval · Declined';

export function formatJointApprovalStatus(requiredCount: 1 | 2, approvedCount: number, declined: boolean): JointApprovalDisplay {
  if (requiredCount === 1) return declined ? 'Declined' : approvedCount > 0 ? 'Approved' : 'Pending approval';
  if (declined) return 'Joint approval · Declined';
  if (approvedCount >= 2) return 'Joint approval · Approved';
  return `Joint approval · ${Math.max(0, approvedCount)}/2 approved`;
}

export function holderBadge(holderNames: readonly string[], originTeamName: string | null): { holder: string; origin: string | null } {
  return { holder: holderNames.length === 0 ? 'No active holder' : holderNames.join(', '), origin: originTeamName ? `Origin: ${originTeamName}` : null };
}
