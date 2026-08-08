import test from "node:test";
import assert from "node:assert/strict";
import {
  canAutoPublishQuestion,
  classifyQuestionRisk,
  QuestionRiskPolicyError,
} from "../src/risk-policy.mjs";

test("classifies a clean question as open and auto-publishable", () => {
  const result = classifyQuestionRisk({ signals: [] });
  assert.deepEqual(result, { risk: "open", signals: [], autoPublishAllowed: true });
  assert.equal(canAutoPublishQuestion(result), true);
});

test("classifies reviewable questions as moderated and blocks auto-publication", () => {
  const result = classifyQuestionRisk({ signals: ["missing_evidence", "external_untrusted_content"] });
  assert.deepEqual(result, {
    risk: "moderated",
    signals: ["external_untrusted_content", "missing_evidence"],
    autoPublishAllowed: false,
  });
  assert.equal(canAutoPublishQuestion(result), false);
});

test("classifies sensitive questions as restricted and blocks auto-publication", () => {
  const result = classifyQuestionRisk({ signals: ["prompt_injection", "personal_data"] });
  assert.equal(result.risk, "restricted");
  assert.equal(result.autoPublishAllowed, false);
});

test("classifies malicious content as prohibited with highest-severity precedence", () => {
  const result = classifyQuestionRisk({ signals: ["missing_evidence", "malicious_file", "prompt_injection"] });
  assert.equal(result.risk, "prohibited");
  assert.equal(result.autoPublishAllowed, false);
});

test("deduplicates and normalizes signals deterministically", () => {
  assert.deepEqual(
    classifyQuestionRisk({ signals: [" PERSONAL_DATA ", "personal_data"] }),
    { risk: "restricted", signals: ["personal_data"], autoPublishAllowed: false },
  );
});

test("rejects unknown or malformed signals", () => {
  assert.throws(
    () => classifyQuestionRisk({ signals: ["looks_risky"] }),
    (error) => error instanceof QuestionRiskPolicyError && error.code === "QUESTION_RISK_SIGNAL_UNKNOWN",
  );
  assert.throws(() => classifyQuestionRisk({ signals: "prompt_injection" }), /must be an array/);
});

test("cannot turn a non-open classification into an automatic publication", () => {
  assert.equal(canAutoPublishQuestion({ risk: "moderated", autoPublishAllowed: true }), false);
  assert.throws(() => canAutoPublishQuestion({ risk: "unknown", autoPublishAllowed: true }), /invalid risk/);
});
