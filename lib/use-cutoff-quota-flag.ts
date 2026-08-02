import { useEffect, useState } from 'react';
import { isFeatureEnabled } from './feature-flags';

/**
 * Batch 7C (ADR-053): shared read of the `cutoff_quota_v1` flag (defaults
 * OFF, see lib/feature-flags.ts). Every cutoff/quota UI surface gates on
 * this hook so the whole feature stays inert until explicitly activated —
 * fails closed (starts `false`) the same way `isFeatureEnabled` itself does.
 */
export function useCutoffQuotaFlag(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isFeatureEnabled('cutoff_quota_v1').then((value) => {
      if (!cancelled) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
