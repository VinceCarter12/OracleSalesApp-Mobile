// F-205: reuses app/(tabs)/meetings/[id].tsx as-is. Nested under `meeting/`
// (not directly at `clients/[id]`, which is the CLIENT detail route) per the
// `app/(executive)/clients/meeting/[id].tsx` precedent.
export { default } from '../../../(tabs)/meetings/[id]';
