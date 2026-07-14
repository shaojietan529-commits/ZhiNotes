"use client";

import { fetchAccountSession } from "@/lib/account/clientSession";

export type AccountCloudSyncGateStatus =
  | "ready"
  | "signed-out"
  | "unconfigured"
  | "unconfirmed"
  | "error";

export type AccountCloudSyncGateReason =
  | "authenticated"
  | "signed-out"
  | "account-unconfigured"
  | "session-unconfirmed"
  | "account-check-failed";

export interface AccountCloudSyncGateResult {
  status: AccountCloudSyncGateStatus;
  authenticated: boolean;
  reason: AccountCloudSyncGateReason;
  retryable: boolean;
  local_use_policy: {
    local_input_can_continue: true;
    sync_failure_can_clear_session: false;
    explicit_logout_required_to_clear_session: true;
    upload_block_does_not_block_writing: true;
  };
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

const ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY: AccountCloudSyncGateResult["local_use_policy"] =
  {
    local_input_can_continue: true,
    sync_failure_can_clear_session: false,
    explicit_logout_required_to_clear_session: true,
    upload_block_does_not_block_writing: true,
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
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "unconfirmed" && session.authenticated) {
    return {
      status: "unconfirmed",
      authenticated: true,
      reason: "session-unconfirmed",
      retryable: true,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "unconfigured") {
    return {
      status: "unconfigured",
      authenticated: false,
      reason: "account-unconfigured",
      retryable: false,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "unconfirmed") {
    return {
      status: "unconfirmed",
      authenticated: false,
      reason: "session-unconfirmed",
      retryable: true,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.status === "error") {
    return {
      status: "error",
      authenticated: session.authenticated,
      reason: "account-check-failed",
      retryable: true,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (session.stale && session.authenticated) {
    return {
      status: "error",
      authenticated: true,
      reason: "account-check-failed",
      retryable: true,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  if (!session.authenticated) {
    return {
      status: "signed-out",
      authenticated: false,
      reason: "signed-out",
      retryable: true,
      local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
      boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
    };
  }
  return {
    status: "ready",
    authenticated: true,
    reason: "authenticated",
    retryable: false,
    local_use_policy: ACCOUNT_SYNC_GATE_LOCAL_USE_POLICY,
    boundary: ACCOUNT_SYNC_GATE_BOUNDARY,
  };
}
