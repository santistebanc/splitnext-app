/** Native / default: the secret itself. Web overrides with a `/j/{token}` URL. */
export function inviteShareText(token: string): string {
  return token;
}
