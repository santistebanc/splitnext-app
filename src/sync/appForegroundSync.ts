import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncAllLobbyGroups } from '@/src/sync/groupSync';

/** Sync all known groups on mount and whenever the app returns to foreground. */
export function useLobbyForegroundSync(): void {
  const ready = useRef(false);

  useEffect(() => {
    void syncAllLobbyGroups().finally(() => {
      ready.current = true;
    });

    const onChange = (state: AppStateStatus) => {
      if (state !== 'active' || !ready.current) return;
      void syncAllLobbyGroups();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
}
