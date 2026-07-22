// F-205: reuses app/(tabs)/clients/create.tsx as-is — calls the real
// `lib/client-service.ts::createClient()` directly (role-agnostic, ADR-020),
// retiring the mock `useManagerStore().addClient()` path.
export { default } from '../../(tabs)/clients/create';
