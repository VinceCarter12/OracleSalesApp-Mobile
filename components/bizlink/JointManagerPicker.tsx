import { Check } from 'lucide-react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../lib/theme';

export interface JointManagerOption { id: string; name: string; teamName: string | null; }

interface Props { options: readonly JointManagerOption[]; selectedIds: readonly string[]; onChange: (ids: string[]) => void; }

export function JointManagerPicker({ options, selectedIds, onChange }: Props) {
  const colors = useBizlinkColors();
  function toggle(id: string): void {
    if (selectedIds.includes(id)) { onChange(selectedIds.filter((value) => value !== id)); return; }
    if (selectedIds.length >= 2) return;
    onChange([...selectedIds, id]);
  }
  return <YStack gap="$2">
    <Text fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>Record holder(s)</Text>
    <Text fontFamily={BIZLINK_FONTS.regular} fontSize={12} color={colors.muted}>Select one or two Managers. The client stays one shared record.</Text>
    {options.map((option) => {
      const selected = selectedIds.includes(option.id);
      return <Button key={option.id} onPress={() => toggle(option.id)} minHeight={48} borderWidth={1} borderColor={selected ? colors.brand : colors.line} backgroundColor={selected ? colors.soft : colors.card} justifyContent="flex-start" paddingHorizontal="$3">
        <XStack alignItems="center" gap="$2" flex={1}><YStack flex={1}><Text fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>{option.name}</Text><Text fontFamily={BIZLINK_FONTS.regular} fontSize={12} color={colors.muted}>{option.teamName ?? 'Team not set'}</Text></YStack>{selected ? <Check size={20} color={colors.brand} /> : null}</XStack>
      </Button>;
    })}
  </YStack>;
}
