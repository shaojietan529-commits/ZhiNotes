export type HighRiskActionId =
  | "cloud-sync-first-push"
  | "restore-writeback"
  | "ai-external-run"
  | "external-resource-load"
  | "bulk-import"
  | "bulk-delete"
  | "sharing-enable";

export type HighRiskConfirmationStatus = "ready" | "mismatch" | "blocked";

export interface HighRiskConfirmationInput {
  actionId: HighRiskActionId;
  requiredPhrase: string;
  typedPhrase: string;
  actorLabel?: string | null;
  localWorkspaceId?: string | null;
  cloudWorkspaceId?: string | null;
  scopeSummary: string;
  riskSummary: string;
  destinationSummary: string;
}

export interface HighRiskConfirmationReceipt {
  format: "zhinote-high-risk-confirmation";
  format_version: 1;
  action_id: HighRiskActionId;
  status: HighRiskConfirmationStatus;
  confirmed: boolean;
  required_phrase: string;
  typed_phrase_present: boolean;
  typed_phrase_matches: boolean;
  matching_policy: "case-sensitive-trimmed";
  created_at: string;
  privacy_note: string;
  actor_label: string | null;
  local_workspace_id: string | null;
  cloud_workspace_id: string | null;
  scope_summary: string;
  risk_summary: string;
  destination_summary: string;
  boundary: {
    uploads_data: false;
    writes_workspace_data: false;
    calls_external_service: false;
    deletes_data: false;
    stores_secret_values: false;
    includes_page_text: false;
    includes_file_bytes: false;
  };
  next_required_action: string;
}

export function buildHighRiskConfirmationReceipt(
  input: HighRiskConfirmationInput
): HighRiskConfirmationReceipt {
  const requiredPhrase = input.requiredPhrase.trim();
  const typedPhrase = input.typedPhrase.trim();
  const hasRequiredPhrase = requiredPhrase.length > 0;
  const typedPhrasePresent = typedPhrase.length > 0;
  const typedPhraseMatches =
    hasRequiredPhrase && typedPhrasePresent && typedPhrase === requiredPhrase;
  const status = getConfirmationStatus({
    hasRequiredPhrase,
    typedPhraseMatches,
  });

  return {
    format: "zhinote-high-risk-confirmation",
    format_version: 1,
    action_id: input.actionId,
    status,
    confirmed: status === "ready",
    required_phrase: requiredPhrase,
    typed_phrase_present: typedPhrasePresent,
    typed_phrase_matches: typedPhraseMatches,
    matching_policy: "case-sensitive-trimmed",
    created_at: new Date().toISOString(),
    privacy_note:
      "Generated locally. This receipt records only confirmation metadata and does not include page text, file bytes, prompts, tokens, credentials, or private report content.",
    actor_label: input.actorLabel ?? null,
    local_workspace_id: input.localWorkspaceId ?? null,
    cloud_workspace_id: input.cloudWorkspaceId ?? null,
    scope_summary: input.scopeSummary,
    risk_summary: input.riskSummary,
    destination_summary: input.destinationSummary,
    boundary: {
      uploads_data: false,
      writes_workspace_data: false,
      calls_external_service: false,
      deletes_data: false,
      stores_secret_values: false,
      includes_page_text: false,
      includes_file_bytes: false,
    },
    next_required_action: getNextRequiredAction(status),
  };
}

function getConfirmationStatus(input: {
  hasRequiredPhrase: boolean;
  typedPhraseMatches: boolean;
}): HighRiskConfirmationStatus {
  if (!input.hasRequiredPhrase) return "blocked";
  return input.typedPhraseMatches ? "ready" : "mismatch";
}

function getNextRequiredAction(status: HighRiskConfirmationStatus) {
  if (status === "ready") {
    return "Phrase matches, but this local receipt does not enable the high-risk action. A separate permission check, audit event, rollback plan, and enabled API are still required.";
  }

  if (status === "mismatch") {
    return "Type the required phrase exactly after reviewing scope, risk, and destination. The action remains disabled.";
  }

  return "Define a required phrase before this high-risk action can enter a confirmation flow.";
}
