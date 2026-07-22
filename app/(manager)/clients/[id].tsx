// F-205: reuses app/(tabs)/clients/[id].tsx as-is — same self-scoped local
// SQLite read path, so this only ever shows clients this manager created.
export { default } from '../../(tabs)/clients/[id]';
