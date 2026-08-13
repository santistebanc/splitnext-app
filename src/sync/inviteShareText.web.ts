import { joinPathForToken } from '@/src/domain/invite';

/** Web: a URL this origin can open. Native keeps the raw token (D-023). */
export function inviteShareText(token: string): string {
  return `${window.location.origin}${joinPathForToken(token, window.location.pathname)}`;
}
