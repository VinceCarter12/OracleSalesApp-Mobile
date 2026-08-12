// F-205: reuses app/(tabs)/meetings/record.tsx as-is — full GPS/photo/
// drafts/CompanionPicker recording flow. The manager-as-requester tag-along
// behavior is enforced by the shared screen's Manager role boundary; Manager
// recording has no companion picker or teammate request payload.
export { default } from '../../(tabs)/meetings/record';
