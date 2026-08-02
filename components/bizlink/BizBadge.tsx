import { useBizlinkColors } from '../../lib/theme';
import { StatusBadge } from '../ui/StatusBadge';

/**
 * Design-System-Catalog §"Needed before implementation" BizBadge — semantic
 * status/kind pill. Deliberately a thin wrapper around the existing
 * `components/ui/StatusBadge.tsx` pill primitive (checked first per the
 * reuse-first rule) rather than a new pill implementation — this component's
 * only job is picking the right `background`/`color` tone for a given
 * request-kind/decision-status semantic, mirrored from
 * Wireframe-Manager-BizLink.html's `.b-edit`/`.b-request`/`.b-reassign`/
 * `.b-tagalong` CSS classes (lines 97-100) where a `BIZLINK_COLORS` token
 * exists for the equivalent hue; `reassign`/`tagalong` variants are included
 * for the catalog's documented future reuse even though Batch 6 PR B's inbox
 * only renders `edit`/`request`.
 */
export type BizBadgeRequestKindVariant = 'edit' | 'request' | 'reassign' | 'tagalong';
// `accepted`/`declined`/`cancelled` (Batch 8, 2026-08-02) added for the My
// Requests screen's tag-along rows — `RemoteTagAlongStatus`
// (types/database.ts) never returns `approved`/`rejected`, only its own
// accepted/declined/cancelled union. Tones reuse the existing
// approved/rejected hues (Wireframe-Sales-BizLink.html's
// `aRequestStatusHtml()` maps `accepted`→`b-success` same as `approved`, and
// `declined`/`cancelled`→`b-lost` same as `rejected`).
export type BizBadgeDecisionStatusVariant = 'pending' | 'approved' | 'rejected' | 'accepted' | 'declined' | 'cancelled';
export type BizBadgeVariant = BizBadgeRequestKindVariant | BizBadgeDecisionStatusVariant;

interface BizBadgeProps {
  variant: BizBadgeVariant;
  label: string;
}

export function BizBadge({ variant, label }: BizBadgeProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const TONES: Record<BizBadgeVariant, { background: string; color: string }> = {
    // Request-kind tones (Wireframe-Manager-BizLink.html .b-edit/.b-request/.b-reassign/.b-tagalong)
    edit: { background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
    request: { background: BIZLINK_COLORS.amberSoft, color: BIZLINK_COLORS.orange },
    reassign: { background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
    tagalong: { background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.ink },
    // Decision-status tones — same soft/tintA/tintB convention as
    // lib/policies/po-confirmation-status-policy.ts's PO_CONFIRMATION_BADGE_TONES
    // and app/(executive)/more/approvals-log.tsx's accepted/declined badges.
    pending: { background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
    approved: { background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.brand },
    rejected: { background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
    accepted: { background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.brand },
    declined: { background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
    cancelled: { background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
  };
  const tone = TONES[variant];
  return <StatusBadge label={label} background={tone.background} color={tone.color} />;
}
