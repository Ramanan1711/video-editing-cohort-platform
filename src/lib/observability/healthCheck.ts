// src/lib/observability/healthCheck.ts
// Automated health diagnostic suite for Supabase Database, Storage buckets, and Authentication API

import { supabase } from '../supabaseClient';

export interface ServiceHealth {
  name: 'database' | 'storage' | 'auth';
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  totalLatencyMs: number;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    auth: ServiceHealth;
  };
}

export async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      // If table doesn't exist, DB is up but schema is pending
      if (error.code === '42P01') {
        return {
          name: 'database',
          status: 'degraded',
          latencyMs,
          message: 'Database reachable but profiles table not found (migration pending).',
        };
      }
      return {
        name: 'database',
        status: 'down',
        latencyMs,
        message: error.message || 'PostgREST query rejected.',
      };
    }

    return {
      name: 'database',
      status: latencyMs > 800 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 800 ? `High latency response (${latencyMs}ms)` : 'Active connection verified.',
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name: 'database',
      status: 'down',
      latencyMs,
      message: err instanceof Error ? err.message : 'Database host unreachable.',
    };
  }
}

export async function checkStorageHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const { data: bucket, error } = await supabase.storage.getBucket('submissions');
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      // Fallback probe: list all buckets
      const { data: list, error: listErr } = await supabase.storage.listBuckets();
      if (!listErr && list) {
        return {
          name: 'storage',
          status: 'degraded',
          latencyMs,
          message: 'Storage service responsive, but "submissions" bucket not found.',
        };
      }
      return {
        name: 'storage',
        status: 'degraded',
        latencyMs,
        message: error.message || 'Storage bucket probing error.',
      };
    }

    return {
      name: 'storage',
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
      message: bucket?.public ? 'Public bucket verified.' : 'Private bucket verified.',
      details: { id: bucket?.id, public: bucket?.public },
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name: 'storage',
      status: 'down',
      latencyMs,
      message: err instanceof Error ? err.message : 'Storage endpoint unreachable.',
    };
  }
}

export async function checkAuthHealth(): Promise<ServiceHealth> {
  const start = performance.now();
  try {
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return {
        name: 'auth',
        status: 'degraded',
        latencyMs,
        message: error.message || 'Auth session check returned error.',
      };
    }

    return {
      name: 'auth',
      status: latencyMs > 600 ? 'degraded' : 'healthy',
      latencyMs,
      message: 'Authentication service active.',
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name: 'auth',
      status: 'down',
      latencyMs,
      message: err instanceof Error ? err.message : 'Auth endpoint unreachable.',
    };
  }
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const [database, storage, auth] = await Promise.all([
    checkDatabaseHealth(),
    checkStorageHealth(),
    checkAuthHealth(),
  ]);

  const totalLatencyMs = Math.max(database.latencyMs, storage.latencyMs, auth.latencyMs);

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (database.status === 'down') {
    status = 'down';
  } else if (
    database.status === 'degraded' ||
    storage.status === 'degraded' ||
    storage.status === 'down' ||
    auth.status === 'degraded' ||
    auth.status === 'down' ||
    totalLatencyMs > 1500
  ) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    totalLatencyMs,
    services: {
      database,
      storage,
      auth,
    },
  };
}

