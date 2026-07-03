export const ACCOUNT_PROFILE_UPDATED_EVENT = "zhinote-account-profile-updated";

export interface ClientAccountInfo {
  id: string;
  email_hint: string;
  display_name: string;
  createdAt: string;
}

export function formatClientAccountLabel(
  account: Pick<ClientAccountInfo, "display_name" | "email_hint"> | null,
  fallback = "账号"
): string {
  const displayName = account?.display_name?.trim();
  if (displayName) return displayName;
  const emailHint = account?.email_hint?.trim();
  if (emailHint) return emailHint;
  return fallback;
}

export function notifyAccountProfileUpdated() {
  window.dispatchEvent(new Event(ACCOUNT_PROFILE_UPDATED_EVENT));
}
