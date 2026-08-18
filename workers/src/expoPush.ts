export async function sendExpoPush(
  accessToken: string | undefined,
  messages: { to: string; title: string; body: string; data?: Record<string, string> }[],
): Promise<void> {
  if (!accessToken || messages.length === 0) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('expo_push_failed', res.status, text.slice(0, 200));
  }
}
