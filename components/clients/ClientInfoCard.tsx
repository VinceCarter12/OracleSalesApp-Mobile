import { Text, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import type { Client } from '../../types';

interface ClientInfoCardProps {
  client: Client;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$0.5">
      <Text fontSize="$2" color="$colorPress">{label}</Text>
      <Text fontSize="$4">{value || '—'}</Text>
    </YStack>
  );
}

/**
 * Read-only client info display. Used in the existing-client fast path so the
 * agent can view the record during a meeting without any form to fill (ADR-015).
 */
export function ClientInfoCard({ client }: ClientInfoCardProps) {
  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor={COLORS.swan}
      backgroundColor={COLORS.polar}
    >
      <Text fontSize="$5" fontWeight="700">{client.company_name}</Text>
      <InfoRow label="Contact Person" value={client.contact_person} />
      <InfoRow label="Customer Type" value={client.customer_type} />
      <InfoRow label="Sales Channel" value={client.sales_channel} />
    </YStack>
  );
}
