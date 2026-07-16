// Shared shape read from `outbox` — its own tiny file so push-batch.ts and
// remote-upsert.ts can both import it without a circular dependency between
// the two.
export interface OutboxRow {
  id: string;
  record_id: string;
  table_name: string;
  operation: 'insert' | 'update';
  payload: string;
  retry_count: number;
}
