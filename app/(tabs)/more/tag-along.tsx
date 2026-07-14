import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { TopBar } from '../../../components/ui/TopBar';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { DuoButton } from '../../../components/ui/DuoButton';

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
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Request Tag-Along" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$2" lineHeight={19}>
          Hilingin sa isang manager o ka-team na sumama sa susunod mong client visit. Ikaw pa rin ang
          magre-record ng buong meeting (client info, GPS, litrato, notes) — kasama lang sila sa litrato
          bilang proof.
        </Text>

        <SectionHeader title="Manager" helper="· kahit sinong manager, walang restriction" />
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

        <SectionHeader title="Ka-team" helper="· ka-team mo lang — bawal ang hindi ka-team (per client)" />
        {TEAMMATES.map((person) => (
          <RosterRow
            key={person.id}
            name={person.name}
            initials={person.initials}
            selected={selectedId === person.id}
            onPress={() => setSelectedId(person.id)}
          />
        ))}

        <SectionHeader title="Note (optional)" />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Closing meeting bukas, sana kasama ka…"
          placeholderTextColor={COLORS.hare}
          multiline
          style={{
            height: 70,
            borderWidth: 2,
            borderColor: COLORS.swan,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontWeight: '700',
            fontSize: 14.5,
            color: COLORS.eel,
            textAlignVertical: 'top',
          }}
        />

        <YStack marginTop="$4">
          <DuoButton label="Send Request" onPress={sendRequest} disabled={!selectedId} />
        </YStack>

        <SectionHeader title="Mga request mo" />
        {requests.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare}>Wala ka pang requests.</Text>
        ) : (
          requests.map((req) => (
            <XStack
              key={req.id}
              alignItems="center"
              justifyContent="space-between"
              paddingVertical={11}
              borderBottomWidth={2}
              borderBottomColor={COLORS.polar}
            >
              <Text fontWeight="700" fontSize={13} color={COLORS.eel}>{req.name}</Text>
              <StatusBadge
                label={req.status === 'pending' ? 'Pending' : 'Accepted'}
                background={req.status === 'pending' ? COLORS.amberSoft : COLORS.greenSoft}
                color={req.status === 'pending' ? COLORS.orange : COLORS.ledgeGreen}
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
      backgroundColor={selected ? COLORS.greenTint : COLORS.snow}
      borderWidth={2}
      borderColor={selected ? COLORS.feather : COLORS.swan}
      borderRadius={16}
      padding="$3"
      marginBottom="$2.5"
    >
      <Avatar initials={initials} size="sm" />
      <YStack flex={1}>
        <Text fontWeight="800" fontSize={13.5} color={COLORS.eel}>{name}</Text>
        {subtitle ? <Text fontSize={11} fontWeight="600" color={COLORS.hare}>{subtitle}</Text> : null}
      </YStack>
      {selected ? <StatusBadge label="Selected" background={COLORS.feather} color={COLORS.snow} /> : null}
    </XStack>
  );
}
