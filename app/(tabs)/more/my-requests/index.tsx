import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardCheck } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useMyRequestStatuses } from '../../../../lib/use-my-request-statuses';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizMyRequestRow } from '../../../../components/bizlink/BizMyRequestRow';

/**
 * Wireframe `a-myrequests` (Wireframe-Sales-BizLink.html ~line 887,
 * `aRenderMyRequests()` ~line 1199): requester-scoped, read-only mirror of
 * `get_my_request_statuses()` covering PO confirmation, client edit, and
 * tag-along requests. No approve/decline action here — the Manager decides,
 * this screen only shows the outcome.
 */
export default function MyRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { rows, loading, error, reload } = useMyRequestStatuses();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="My Requests" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Status ng sarili mong PO confirmation, client-edit, at tag-along requests. View-only ito: Manager lang ang
          may approval decision.
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : rows.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$2">
            <ClipboardCheck size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Wala ka pang request.
            </Text>
          </YStack>
        ) : (
          rows.map((row) => (
            <BizMyRequestRow
              key={row.id}
              row={row}
              onPress={() => router.push(`/(tabs)/more/my-requests/${row.id}`)}
            />
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
