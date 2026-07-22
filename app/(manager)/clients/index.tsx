// F-205: reuses app/(tabs)/clients/index.tsx's screen body as-is — its
// `useClients()` hook is already self-scoped to `agent_id = own profileId`
// (see lib/useClients.ts), the same mechanism that isolates a Sales agent's
// own clients today, so no new hook/query is needed for the manager's own
// clients (decision 1: app-query-level self-scoping is sufficient). Route
// hrefs inside that screen resolve to this `(manager)/clients` group
// automatically via `lib/use-role-routes.ts`'s `useClientFlowRoutes()`.
export { default } from '../../(tabs)/clients/index';
