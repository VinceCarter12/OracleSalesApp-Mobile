// F-205: Manager's own-client Record Meeting entry point reuses the exact
// Sales picker. `useClients()` is profile-scoped (profiles.id), so this list
// contains only the signed-in Manager's locally mirrored clients.
export { default } from '../../(tabs)/meetings/select-client';
