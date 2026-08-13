/** Native / default: the secret itself. Web overrides with a `/join?token=` URL. */
export function inviteShareText(token: string): string {
  return token;
}
