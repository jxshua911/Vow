import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

export type VowTelemetryEvent =
  | 'app_opened'
  | 'view_changed'
  | 'goal_created'
  | 'goal_plan_generated'
  | 'calendar_connected'
  | 'calendar_event_created'
  | 'paywall_viewed'
  | 'purchase_started'
  | 'purchase_verified'
  | 'purchase_failed'
  | 'app_error'
  | 'ai_error';

const APP_VERSION = '1.4';

function platform(): 'android' | 'ios' | 'web' | 'unknown' {
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios' || p === 'web' ? p : 'unknown';
}

export async function track(event_name: VowTelemetryEvent, metadata: Record<string, unknown> = {}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const safeMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key, value]) =>
        ['screen', 'source', 'mode', 'error_code', 'status', 'feature', 'reason'].includes(key) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ),
    );
    await supabase.from('vow_app_events').insert({
      user_id: data.user.id,
      event_name,
      platform: platform(),
      app_version: APP_VERSION,
      metadata: safeMetadata,
    });
  } catch {
    // Telemetry must never break the product.
  }
}

export function installGlobalErrorTelemetry() {
  const onError = (event: ErrorEvent) => {
    void track('app_error', {
      error_code: 'window_error',
      source: 'window',
      reason: event.message?.slice(0, 160) || 'unknown',
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? 'unknown');
    void track('app_error', {
      error_code: 'unhandled_rejection',
      source: 'window',
      reason: reason.slice(0, 160),
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
