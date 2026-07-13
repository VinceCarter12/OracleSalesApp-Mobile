import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { Bell, Building2, Ellipsis, Handshake, Hourglass, Magnet, PencilLine, RefreshCw, Users } from 'lucide-react-native';
import { COLORS } from '../../lib/theme';
import { managerProfile } from '../../lib/manager-data';
import { useManagerDashboard } from '../../lib/useManagerDashboard';
import { StatCard } from '../../components/manager/StatCard';
import { TeamAvatarStrip } from '../../components/manager/TeamAvatarStrip';
import { TeamMeetingRow } from '../../components/manager/TeamMeetingRow';
import { QuickActionsGrid } from '../../components/manager/QuickActionsGrid';

export default function ManagerDashboardScreen() {
  const { summary, loading } = useManagerDashboard();
  const profile = managerProfile();

  if (loading || !summary) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Spinner size="large" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$2">
        <View width={44} height={44} borderRadius={22} alignItems="center" justifyContent="center" backgroundColor={COLORS.greenTint}>
          <Text fontWeight="800" fontSize={16} color={COLORS.ledgeGreen}>
            {profile.fullName.split(' ').map((part) => part[0]).join('')}
          </Text>
        </View>
        <YStack flex={1}>
          <Text fontWeight="800" fontSize={15.5} color={COLORS.eel}>
            Good morning, {summary.managerName}!
          </Text>
          <View
            alignSelf="flex-start"
            borderRadius={999}
            paddingHorizontal={10}
            paddingVertical={3}
            marginTop={2}
            backgroundColor={COLORS.purpleSoft}
          >
            <Text fontSize={10.5} fontWeight="800" color={COLORS.purple}>
              {profile.title}
            </Text>
          </View>
        </YStack>
        <View
          width={40}
          height={40}
          borderRadius={20}
          alignItems="center"
          justifyContent="center"
          backgroundColor={COLORS.polar}
          onPress={() => router.push('/(manager)/approvals')}
        >
          <Bell size={19} color={COLORS.eel} />
        </View>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <XStack gap="$2.5" paddingVertical="$2">
          <StatCard
            icon={<Magnet size={16} color={COLORS.blue} />}
            iconBackground={COLORS.blueSoft}
            value={summary.teamProspects}
            label="Team Prospects"
            delta="+3 this week"
            onPress={() => router.push('/(manager)/more/clients')}
          />
          <StatCard
            icon={<Building2 size={16} color={COLORS.ledgeGreen} />}
            iconBackground={COLORS.greenTint}
            value={summary.teamClients}
            label="Team Clients"
            delta="+12.1% vs last mo."
            onPress={() => router.push('/(manager)/more/clients')}
          />
          <StatCard
            icon={<Handshake size={16} color={COLORS.orange} />}
            iconBackground={COLORS.amberSoft}
            value={summary.teamMeetings}
            label="Team Meetings"
            delta={`${summary.teamMeetingsSuccessful} successful`}
            onPress={() => router.push('/(manager)/more/meetings')}
          />
          <StatCard
            icon={<Users size={16} color={COLORS.purple} />}
            iconBackground={COLORS.purpleSoft}
            value={summary.agentCount}
            label="Agents"
            delta="under your team"
            deltaTone="warn"
            onPress={() => router.push('/(manager)/team')}
          />
        </XStack>

        <XStack gap="$2.5" marginTop="$3">
          <YStack flex={1} backgroundColor={COLORS.feather} borderRadius={16} padding="$3.5" onPress={() => router.push('/(manager)/more/meetings')}>
            <XStack alignItems="center" gap="$1.5">
              <Handshake size={14} color={COLORS.snow} />
              <Text fontSize={11.5} fontWeight="800" color={COLORS.snow}>
                Team meetings
              </Text>
            </XStack>
            <Text fontSize={28} fontWeight="800" color={COLORS.snow} marginTop={2}>
              {summary.teamMeetings}
            </Text>
            <Text fontSize={11.5} fontWeight="700" color={COLORS.snow} opacity={0.9}>
              {summary.teamMeetingsSuccessful} successful
            </Text>
          </YStack>
          <YStack
            flex={1}
            backgroundColor={COLORS.snow}
            borderWidth={2}
            borderColor={COLORS.swan}
            borderRadius={16}
            padding="$3.5"
            onPress={() => router.push('/(manager)/approvals')}
          >
            <XStack alignItems="center" gap="$1.5">
              <PencilLine size={14} color={COLORS.wolf} />
              <Text fontSize={11.5} fontWeight="800" color={COLORS.wolf}>
                Pending approvals
              </Text>
            </XStack>
            <Text fontSize={28} fontWeight="800" color={COLORS.purple} marginTop={2}>
              {summary.pendingApprovals}
            </Text>
            <Text fontSize={11.5} fontWeight="700" color={COLORS.hare}>
              Edits + reassignments
            </Text>
          </YStack>
        </XStack>

        <XStack alignItems="center" gap="$2" backgroundColor={COLORS.blueSoft} borderWidth={2} borderColor={COLORS.blueBorder} borderRadius={14} padding="$3" marginTop="$3">
          <RefreshCw size={18} color={COLORS.blue} />
          <YStack flex={1}>
            <Text fontSize={12.5} fontWeight="800" color={COLORS.blue}>
              {summary.pendingSyncRecords} records pending sync
            </Text>
            <Text fontSize={11} fontWeight="600" color={COLORS.purple}>
              Team data auto-uploads when online
            </Text>
          </YStack>
        </XStack>

        <XStack
          alignItems="center"
          gap="$2"
          backgroundColor={COLORS.amberSoft}
          borderWidth={2}
          borderColor="#D9B168"
          borderRadius={14}
          padding="$3"
          marginTop="$2.5"
          onPress={() => router.push('/(manager)/more/clients')}
        >
          <Hourglass size={18} color={COLORS.orange} />
          <YStack flex={1}>
            <Text fontSize={12.5} fontWeight="800" color={COLORS.orange}>
              {summary.deadlineWarningCount} prospects across the team: info deadline malapit na
            </Text>
            <Text fontSize={11} fontWeight="600" color="#8C6A2E">
              1-month rule — kumpletuhin o auto-delete
            </Text>
          </YStack>
        </XStack>

        <SectionHeader title="My Team" onPress={() => router.push('/(manager)/team')} />
        <TeamAvatarStrip agents={summary.agents} onSelectAgent={(agentId) => router.push(`/(manager)/team/${agentId}`)} />

        <SectionHeader title="Recent Team Meetings" onPress={() => router.push('/(manager)/more/meetings')} />
        <YStack>
          {summary.recentMeetings.map((meeting) => (
            <TeamMeetingRow
              key={meeting.id}
              meeting={meeting}
              onPress={(meetingId) => router.push(`/(manager)/more/meetings/${meetingId}`)}
            />
          ))}
        </YStack>

        <SectionHeader title="Quick Actions" />
        <QuickActionsGrid
          actions={[
            {
              key: 'approvals',
              label: 'Approvals',
              icon: <PencilLine size={16} color={COLORS.ledgeGreen} />,
              badgeCount: summary.pendingApprovals,
              onPress: () => router.push('/(manager)/approvals'),
            },
            {
              key: 'tagalong',
              label: 'Tag-Along',
              icon: <Users size={16} color={COLORS.ledgeGreen} />,
              badgeCount: summary.pendingTagAlongRequests,
              onPress: () => router.push('/(manager)/tag-along'),
            },
            {
              key: 'team',
              label: 'My Team',
              icon: <Users size={16} color={COLORS.ledgeGreen} />,
              onPress: () => router.push('/(manager)/team'),
            },
            {
              key: 'more',
              label: 'More',
              icon: <Ellipsis size={16} color={COLORS.ledgeGreen} />,
              onPress: () => router.push('/(manager)/more'),
            },
          ]}
        />
      </ScrollView>
    </YStack>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <XStack alignItems="center" marginTop="$4" marginBottom="$2.5">
      <Text fontSize={16} fontWeight="800" color={COLORS.eel}>
        {title}
      </Text>
      {onPress ? (
        <Text fontSize={12} fontWeight="800" color={COLORS.blue} marginLeft="auto" onPress={onPress}>
          View all ›
        </Text>
      ) : null}
    </XStack>
  );
}
