import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(
  channelName: string,
  table: string,
  filter: string | undefined,
  callback: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!supabase || !enabled) return;

    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter },
        callback,
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Re-fetch once so the UI isn't stale if realtime dropped
          callback();
          if (err) console.warn(`[useRealtime] ${channelName} subscription error:`, err);
        }
      });

    return () => { supabase!.removeChannel(channel); };
  }, [channelName, table, filter, callback, enabled]);
}
