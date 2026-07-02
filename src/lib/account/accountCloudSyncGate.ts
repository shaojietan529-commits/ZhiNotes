"use client";

import { fetchAccountSession } from "@/lib/account/clientSession";

export type AccountCloudSyncGateStatus =
  | "ready"
  | "signed-out"
  | "unconfigured"
  | "error";

export type AccountCloudSyncGateReason =
  | "authenticated"
  | "signed-out"
  | "account-unconfigured"
  | "account-check-failed";

export interface AccountCloudSyncGateResult {
  status: AccountCloudSyncGateStatus;
  authenticated: boolean;
  reason: AccountCloudSyncGateReason;
  retryable: boolean;
  boundary: {
    reads_page_body_text: false;
    reads_database_row_values: false;
    uploads_workspace_data: false;
    mutates_workspace_data: false;
    stores_account_email: false;
  };
}

const ACCOUNT_SYNC_GATE_BOUNDARY: AccountCloudSyncGateResult["boundary"] = {
  reads_page_body_text: false,
  reads_database_row_values: false,
  uploads_workspace_data: false,
  mutates_workspace_data: false,
  stores_account_email: false,
};

export async function checkAccountCloudSyncGate(
  options: { force?: boolean } = {}
): Promise<AccountCloudSyncGateResult> {
  const session = await fetchAccountSession(options);
  if (session.status === "unconfigured" && session.authenticated) {
    return {
      status: "error",
      authenticated: true,
      reason: "account-check-failed",
      retryable: true,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "unconfigured") {
    return {
      status: "unconfigured",
      authenticated: false,
      reason: "account-unconfigured",
      retryable: false,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "error") {
    return {
      status: "error",
      authenticated: session.authenticated,
      reason: "account-check-failed",
      retryable: true,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.stale && session.authenticated) {
    return {
      status: "error",
      authenticated: true,
      reason: "account-check-failed",
      retryable: true,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (!session.authenticated) {
    return {
      status: "signed-out",
      authenticated: false,
      reason: "signed-out",
      retryable: true,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  return {
    status: "ready",
    authenticated: true,
    reason: "authenticated",
    retryable: false,
    boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
  };
}
