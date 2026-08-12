export const TABLES_TO_WIPE = [
  'clients','meetings','meeting_drafts','outbox','pending_uploads','tag_along_requests',
  'company_names_snapshot','team_roster_snapshot','manager_directory_snapshot',
  'joint_manager_requests','joint_manager_request_decisions','client_record_holders',
  'client_cycles_snapshot','agenda_catalog_snapshot','agenda_policy_versions_snapshot','agenda_stage_rules_snapshot',
] as const;
