// F-205: reuses app/(tabs)/meetings/record.tsx as-is — full GPS/photo/
// drafts/CompanionPicker recording flow. The manager-as-requester tag-along
// behavior (decision 2: companions insert pre-accepted, not pending) is a
// role check (`useSession().role === 'sales_manager'`) inside that shared
// screen, not a route check, so it's correct here without any wrapper.
export { default } from '../../(tabs)/meetings/record';
