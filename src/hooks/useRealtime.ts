import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(
  channelName: string,
  table: string,
  filter: string | undefined,
  callback: () => void,
) {
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter },
        callback,
      )
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [channelName, table, filter, callback]);
}
