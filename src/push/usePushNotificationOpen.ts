import { notificationsAvailable } from '@/src/push/notificationsAvailable';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect } from 'react';

/** Tap a notification → open that group's hub. */
export function usePushNotificationOpen() {
  const router = useRouter();

  useEffect(() => {
    if (!notificationsAvailable(Constants.appOwnership)) return;

    let cancelled = false;
    let sub: { remove: () => void } | undefined;

    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;
      const listener = Notifications.addNotificationResponseReceivedListener((response) => {
        const groupId = response.notification.request.content.data?.groupId;
        if (typeof groupId === 'string' && groupId.length > 0) {
          router.push(`/group/${groupId}`);
        }
      });
      if (cancelled) {
        listener.remove();
        return;
      }
      sub = listener;
    });

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);
}
