import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

/** Tap a notification → open that group's hub. */
export function usePushNotificationOpen() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const groupId = response.notification.request.content.data?.groupId;
      if (typeof groupId === 'string' && groupId.length > 0) {
        router.push(`/group/${groupId}`);
      }
    });
    return () => sub.remove();
  }, [router]);
}
