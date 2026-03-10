import { Platform } from 'react-native';
import { supabase } from '@/supabase';

declare global {
  interface Window {
    __sessionLogId?: string;
    __sessionLogged?: boolean;
  }
}

let activeSessionId: string | null = null;

async function getIpInfo(): Promise<{ ip: string; country: string; region: string; city: string } | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data.ip ?? 'unknown',
      country: data.country_name ?? '',
      region: data.region ?? '',
      city: data.city ?? '',
    };
  } catch {
    return null;
  }
}

// Logs a visit on every page load. userId is null for unauthenticated visitors.
export async function logSessionStart(userId: string | null): Promise<void> {
  if (Platform.OS !== 'web') return;

  // Only log once per page load
  if (typeof window !== 'undefined' && window.__sessionLogged) return;
  if (typeof window !== 'undefined') window.__sessionLogged = true;

  const ipInfo = await getIpInfo();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const { data, error } = await supabase
    .from('session_logs')
    .insert({
      user_id: userId,
      ip: ipInfo?.ip ?? 'unknown',
      country: ipInfo?.country ?? '',
      region: ipInfo?.region ?? '',
      city: ipInfo?.city ?? '',
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (!error && data) {
    activeSessionId = data.id;
    if (typeof window !== 'undefined') {
      window.__sessionLogId = data.id;
    }
  }
}

export async function logSessionEnd(): Promise<void> {
  if (Platform.OS !== 'web') return;

  const sessionId = activeSessionId ?? (typeof window !== 'undefined' ? window.__sessionLogId : null);
  if (!sessionId) return;

  await supabase
    .from('session_logs')
    .update({ logout_at: new Date().toISOString() })
    .eq('id', sessionId);

  activeSessionId = null;
  if (typeof window !== 'undefined') {
    window.__sessionLogId = undefined;
    window.__sessionLogged = undefined;
  }
}

// Captures tab/browser close
export function registerUnloadHandler(): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  const handler = () => {
    const sessionId = activeSessionId ?? window.__sessionLogId;
    if (!sessionId) return;
    supabase.from('session_logs').update({ logout_at: new Date().toISOString() }).eq('id', sessionId);
  };

  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}
