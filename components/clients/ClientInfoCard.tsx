import { Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import type { Client } from '../../types';

interface ClientInfoCardProps {
  client: Client;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$0.5">
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
      <Text fontSize={14} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>{value || '—'}</Text>
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
      padding={18}
      borderRadius={24}
      backgroundColor={BIZLINK_COLORS.card}
      shadowColor="rgba(18,39,28,0.05)"
      shadowOffset={{ width: 0, height: 1 }}
      shadowOpacity={1}
      shadowRadius={2}
    >
      <Text fontSize={15.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
      <InfoRow label="Contact Person" value={client.contact_person} />
      <InfoRow label="Customer Type" value={client.customer_type} />
      <InfoRow label="Sales Channel" value={client.sales_channel} />
    </YStack>
  );
}
