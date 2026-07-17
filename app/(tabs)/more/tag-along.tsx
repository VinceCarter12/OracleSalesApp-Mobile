import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';

// Mock rosters until the manager/team directory (T-002+ backend) exists.
const MANAGERS = [
  { id: 'm1', name: 'Erika Villanueva', initials: 'EV', role: 'Sales Manager' },
  { id: 'm2', name: 'Marco Dizon', initials: 'MD', role: 'Sales Manager' },
];
const TEAMMATES = [
  { id: 't1', name: 'Alyssa Reyes', initials: 'AR' },
  { id: 't2', name: 'Paolo Cruz', initials: 'PC' },
];

interface PendingRequest {
  id: string;
  name: string;
  status: 'pending' | 'accepted';
}

export default function TagAlongScreen() {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [requests, setRequests] = useState<PendingRequest[]>([]);

  function sendRequest(): void {
    if (!selectedId) return;
    const person = [...MANAGERS, ...TEAMMATES].find((p) => p.id === selectedId);
    if (!person) return;
    setRequests((prev) => [{ id: `${Date.now()}`, name: person.name, status: 'pending' }, ...prev]);
    setSelectedId(null);
    setNote('');
    showToast('✓ Tag-along request sent');
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Request Tag-Along" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2" lineHeight={19}>
          Hilingin sa isang manager o ka-team na sumama sa susunod mong client visit. Ikaw pa rin ang
          magre-record ng buong meeting (client info, GPS, litrato, notes) — kasama lang sila sa litrato
          bilang proof.
        </Text>

        <BizSectionHeader title="Manager" helper="· kahit sinong manager, walang restriction" />
        {MANAGERS.map((person) => (
          <RosterRow
            key={person.id}
            name={person.name}
            initials={person.initials}
            subtitle={person.role}
            selected={selectedId === person.id}
            onPress={() => setSelectedId(person.id)}
          />
        ))}

        <BizSectionHeader title="Ka-team" helper="· ka-team mo lang — bawal ang hindi ka-team (per client)" />
        {TEAMMATES.map((person) => (
          <RosterRow
            key={person.id}
            name={person.name}
            initials={person.initials}
            selected={selectedId === person.id}
            onPress={() => setSelectedId(person.id)}
          />
        ))}

        <BizSectionHeader title="Note (optional)" />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Closing meeting bukas, sana kasama ka…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          multiline
          style={{
            height: 74,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
            textAlignVertical: 'top',
          }}
        />

        <YStack marginTop="$4">
          <BizButton label="Send Request" onPress={sendRequest} disabled={!selectedId} />
        </YStack>

        <BizSectionHeader title="Mga request mo" />
        {requests.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Wala ka pang requests.</Text>
        ) : (
          requests.map((req) => (
            <XStack
              key={req.id}
              alignItems="center"
              justifyContent="space-between"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
            >
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13} color={BIZLINK_COLORS.text}>{req.name}</Text>
              <StatusBadge
                label={req.status === 'pending' ? 'Pending' : 'Accepted'}
                background={req.status === 'pending' ? BIZLINK_COLORS.soft : BIZLINK_COLORS.tintA}
                color={req.status === 'pending' ? BIZLINK_COLORS.navy : BIZLINK_COLORS.ink}
              />
            </XStack>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}

function RosterRow({
  name,
  initials,
  subtitle,
  selected,
  onPress,
}: {
  name: string;
  initials: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      onPress={onPress}
      alignItems="center"
      gap="$3"
      backgroundColor={selected ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
      minHeight={44}
    >
      <Avatar initials={initials} size="sm" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.ink} />
      <YStack flex={1}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>{name}</Text>
        {subtitle ? <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{subtitle}</Text> : null}
      </YStack>
      {selected ? <StatusBadge label="Selected" background={BIZLINK_COLORS.brand} color={BIZLINK_COLORS.card} /> : null}
    </XStack>
  );
}
