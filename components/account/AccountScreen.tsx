import { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { TopBar } from '../ui/TopBar';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { DuoButton } from '../ui/DuoButton';

export interface AccountSecurityItem {
  key: string;
  icon: ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
}

interface AccountScreenProps {
  avatar: ReactNode;
  name: string;
  subtitle: string;
  securityItems: AccountSecurityItem[];
  onSignOut: () => void;
  statsSlot?: ReactNode;
  sessionPolicyText?: string;
}

/**
 * Shared "Account & Security" screen shell — profile card, security list, optional
 * stats/session-policy slots, and sign out. RSR, Manager, and Executive account
 * screens differ only in profile data, stats, and which security rows apply.
 */
export function AccountScreen({
  avatar,
  name,
  subtitle,
  securityItems,
  onSignOut,
  statsSlot,
  sessionPolicyText,
}: AccountScreenProps) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Account & Security" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          {avatar}
          <YStack>
            <Text fontWeight="800" fontSize={17} color={COLORS.eel}>{name}</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare}>{subtitle}</Text>
          </YStack>
        </Card>

        {statsSlot}

        <SectionHeader title="Security" />
        <Card padding={0}>
          {securityItems.map((item, index) => (
            <XStack
              key={item.key}
              alignItems="center"
              gap="$2.5"
              padding="$3.5"
              borderBottomWidth={index === securityItems.length - 1 ? 0 : 2}
              borderBottomColor={COLORS.polar}
              onPress={item.onPress}
            >
              {item.icon}
              <YStack flex={1}>
                <Text fontSize={13.5} fontWeight="700" color={COLORS.eel}>{item.label}</Text>
                {item.sublabel ? (
                  <Text fontSize={11} fontWeight="600" color={COLORS.hare}>{item.sublabel}</Text>
                ) : null}
              </YStack>
              {item.onPress ? <Text color={COLORS.swanLedge}>›</Text> : null}
            </XStack>
          ))}
        </Card>

        {sessionPolicyText ? (
          <Card flat marginTop="$4">
            <XStack alignItems="center" gap="$2">
              <Lock size={13} color={COLORS.eel} />
              <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>Session policy</Text>
            </XStack>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1" lineHeight={18}>
              {sessionPolicyText}
            </Text>
          </Card>
        ) : null}

        <YStack marginTop="$5">
          <DuoButton label="Sign Out" variant="red" onPress={onSignOut} />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
