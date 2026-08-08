/**
 * Deterministic Question risk policy.
 *
 * Callers translate authenticated context, moderation findings, and upload
 * scans into the explicit signal names below. The domain layer deliberately
 * does not inspect files or invoke a classifier, so the publication decision
 * remains reproducible and auditable.
 */

export const QUESTION_RISK_LEVELS = Object.freeze([
  "open",
  "moderated",
  "restricted",
  "prohibited",
]);

export const QUESTION_RISK_SIGNALS = Object.freeze({
  PROHIBITED: Object.freeze([
    "malicious_file",
    "credential_exfiltration",
    "illegal_instruction",
    "explicit_policy_violation",
  ]),
  RESTRICTED: Object.freeze([
    "prompt_injection",
    "unsafe_experiment",
    "personal_data",
    "unverified_identity",
    "restricted_topic",
  ]),
  MODERATED: Object.freeze([
    "external_untrusted_content",
    "missing_evidence",
    "spam_suspected",
    "needs_human_review",
  ]),
});

const LEVEL_SIGNALS = new Map([
  ["prohibited", new Set(QUESTION_RISK_SIGNALS.PROHIBITED)],
  ["restricted", new Set(QUESTION_RISK_SIGNALS.RESTRICTED)],
  ["moderated", new Set(QUESTION_RISK_SIGNALS.MODERATED)],
]);

const SIGNAL_LEVELS = new Map(
  [...LEVEL_SIGNALS].flatMap(([level, signals]) => [...signals].map((signal) => [signal, level])),
);

export class QuestionRiskPolicyError extends Error {
  constructor(message, code = "QUESTION_RISK_INVALID") {
    super(message);
    this.name = "QuestionRiskPolicyError";
    this.code = code;
  }
}

function normalizeSignals(signals) {
  if (signals === undefined) return [];
  if (!Array.isArray(signals)) {
    throw new QuestionRiskPolicyError("risk signals must be an array");
  }

  const normalized = [...new Set(signals.map((signal) => {
    if (typeof signal !== "string" || signal.trim().length === 0) {
      throw new QuestionRiskPolicyError("risk signals must contain non-empty strings");
    }
    return signal.trim().toLowerCase();
  }))].sort();

  const unknown = normalized.find((signal) => !SIGNAL_LEVELS.has(signal));
  if (unknown) {
    throw new QuestionRiskPolicyError(`unknown risk signal: ${unknown}`, "QUESTION_RISK_SIGNAL_UNKNOWN");
  }
  return normalized;
}

/**
 * Classify a Question from explicit, already-established policy signals.
 * Severity is monotonic: prohibited > restricted > moderated > open.
 * Only an open Question may be automatically published.
 */
export function classifyQuestionRisk({ signals } = {}) {
  const normalizedSignals = normalizeSignals(signals);
  const risk = normalizedSignals.reduce((highest, signal) => {
    const level = SIGNAL_LEVELS.get(signal);
    if (level === "prohibited") return "prohibited";
    if (level === "restricted" && highest !== "prohibited") return "restricted";
    if (level === "moderated" && highest === "open") return "moderated";
    return highest;
  }, "open");

  return Object.freeze({
    risk,
    signals: Object.freeze(normalizedSignals),
    autoPublishAllowed: risk === "open",
  });
}

/** Return the stable publication decision for a previously classified result. */
export function canAutoPublishQuestion(classification) {
  if (!classification || typeof classification !== "object") {
    throw new QuestionRiskPolicyError("classification is required");
  }
  if (!QUESTION_RISK_LEVELS.includes(classification.risk)) {
    throw new QuestionRiskPolicyError("classification has an invalid risk", "QUESTION_RISK_INVALID");
  }
  return classification.risk === "open" && classification.autoPublishAllowed === true;
}
