/**
 * Backend Realtime Integration Middleware
 * Automatically emits realtime events for all CRUD operations
 */

import { RealtimeEventEmitter } from '../services/realtimeEventEmitter';

export interface RealtimeServiceConfig {
  table: string;
  notifyUsers?: boolean;
  broadcastEvent?: boolean;
}

/**
 * Wrap a service method to emit realtime events
 */
export function withRealtimeEmission(
  serviceFn: (...args: any[]) => Promise<any>,
  config: RealtimeServiceConfig,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
) {
  return async (...args: any[]) => {
    const result = await serviceFn(...args);

    // Emit realtime event
    try {
      if (eventType === 'INSERT') {
        await RealtimeEventEmitter.emitInsert(config.table, result);
      } else if (eventType === 'UPDATE') {
        // For updates, we need the old and new records
        // This is context-dependent, so should be handled per-case
        await RealtimeEventEmitter.emitUpdate(config.table, result);
      } else if (eventType === 'DELETE') {
        await RealtimeEventEmitter.emitDelete(config.table, result);
      }
    } catch (error) {
      console.error(`[RealtimeMiddleware] Failed to emit event for ${config.table}:`, error);
      // Don't throw - we want the main operation to succeed
    }

    return result;
  };
}

/**
 * Enhanced service wrapper for realtime integration
 */
export class RealtimeServiceWrapper {
  static create<T extends Record<string, any>>(
    originalService: T,
    config: RealtimeServiceConfig
  ): T {
    const wrapper: any = {};

    for (const [key, value] of Object.entries(originalService)) {
      if (typeof value === 'function') {
        // Detect operation type from method name
        let eventType: 'INSERT' | 'UPDATE' | 'DELETE' | null = null;

        if (
          key.includes('create') ||
          key.includes('add') ||
          key.includes('insert')
        ) {
          eventType = 'INSERT';
        } else if (key.includes('update') || key.includes('patch')) {
          eventType = 'UPDATE';
        } else if (key.includes('delete') || key.includes('remove')) {
          eventType = 'DELETE';
        }

        if (eventType) {
          wrapper[key] = withRealtimeEmission(value.bind(originalService), config, eventType);
        } else {
          wrapper[key] = value.bind(originalService);
        }
      } else {
        wrapper[key] = value;
      }
    }

    return wrapper;
  }
}

/**
 * Helper to emit events in service methods
 */
export async function emitRealtimeEvent(
  table: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  record: Record<string, any>,
  oldRecord?: Record<string, any>
) {
  try {
    if (eventType === 'INSERT') {
      await RealtimeEventEmitter.emitInsert(table, record);
    } else if (eventType === 'UPDATE') {
      await RealtimeEventEmitter.emitUpdate(table, record, oldRecord);
    } else if (eventType === 'DELETE') {
      await RealtimeEventEmitter.emitDelete(table, record);
    }
  } catch (error) {
    console.error(`[emitRealtimeEvent] Error emitting ${eventType} event:`, error);
  }
}

/**
 * Batch emit multiple events
 */
export async function batchEmitRealtimeEvents(
  events: Array<{
    table: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    record: Record<string, any>;
    oldRecord?: Record<string, any>;
  }>
) {
  await Promise.all(
    events.map((event) =>
      emitRealtimeEvent(
        event.table,
        event.eventType,
        event.record,
        event.oldRecord
      )
    )
  );
}
