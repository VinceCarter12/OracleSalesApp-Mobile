import { describe, expect, it } from 'vitest';
import { TABLES_TO_WIPE } from './wipe-local-data-tables';

describe('account-switch local wipe coverage', () => {
  it('wipes all Joint Manager and directory mirrors', () => {
    expect(TABLES_TO_WIPE).toEqual(expect.arrayContaining([
      'manager_directory_snapshot',
      'joint_manager_requests',
      'joint_manager_request_decisions',
      'client_record_holders',
    ]));
  });
});
