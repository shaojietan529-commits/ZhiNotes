export const ACCOUNT_PROFILE_UPDATED_EVENT = "zhinote-account-profile-updated";

export interface ClientAccountInfo {
  id: string;
  email_hint: string;
  display_name: string;
  createdAt: string;
}

export function notifyAccountProfileUpdated() {
  window.dispatchEvent(new Event(ACCOUNT_PROFILE_UPDATED_EVENT));
}
