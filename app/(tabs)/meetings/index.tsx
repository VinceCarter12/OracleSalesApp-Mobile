import { FlatList, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { Button, Separator, Spinner, Text, XStack, YStack } from 'tamagui';
import { useMeetings } from '../../../lib/useMeetings';
import type { Meeting } from '../../../types';

function MeetingRow({ meeting }: { meeting: Meeting }) {
  return (
    <YStack padding="$4" gap="$1">
      <Text fontWeight="600" fontSize="$4">{meeting.client_name ?? 'Unknown Client'}</Text>
      <Text fontSize="$3">{meeting.outcome}</Text>
      <Text fontSize="$2" color="$colorPress">
        {new Date(meeting.logged_at).toLocaleString()}
      </Text>
    </YStack>
  );
}

export default function MeetingsScreen() {
  const { meetings, loading, refresh } = useMeetings();

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack padding="$4" justifyContent="flex-end">
        <Link href="/(tabs)/meetings/record" asChild>
          <Button size="$3" theme="active">+ Record Meeting</Button>
        </Link>
      </XStack>

      {loading && !meetings.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MeetingRow meeting={item} />}
          ItemSeparatorComponent={() => <Separator />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color="$colorPress">No meetings recorded yet.</Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
