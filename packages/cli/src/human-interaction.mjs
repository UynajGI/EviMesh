import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";

export class CliHumanInteractionError extends Error {
  constructor(message, code = "CLI_HUMAN_INTERACTION_REQUIRED") {
    super(message);
    this.name = "CliHumanInteractionError";
    this.code = code;
  }
}

async function visibleQuestion(input, output, prompt) {
  const readline = createInterface({ input, output, terminal: true });
  try { return await readline.question(prompt); } finally { readline.close(); }
}

async function hiddenQuestion(input, output, prompt) {
  output.write(prompt);
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const readline = createInterface({ input, output: muted, terminal: true });
  try { return await readline.question(""); } finally { readline.close(); output.write("\n"); }
}

function terminalInteraction(input = process.stdin, output = process.stderr) {
  if (input?.isTTY !== true || output?.isTTY !== true) {
    throw new CliHumanInteractionError("this operation requires a local interactive terminal", "CLI_HUMAN_TTY_REQUIRED");
  }
  return Object.freeze({
    async secret(prompt) { return hiddenQuestion(input, output, prompt); },
    async authorize({ prompt, phrase }) {
      const answer = await visibleQuestion(input, output, `${prompt}\nType ${phrase} to continue: `);
      return answer.trim() === phrase;
    },
  });
}

/** A test-only interaction may be injected through runCli; no CLI flag or environment variable enables it. */
export function requireHumanInteraction(testInteraction = null) {
  if (testInteraction !== null && testInteraction !== undefined) {
    if (testInteraction.__testOnly !== true || typeof testInteraction.secret !== "function" || typeof testInteraction.authorize !== "function") {
      throw new CliHumanInteractionError("invalid test interaction adapter", "CLI_HUMAN_INTERACTION_INVALID");
    }
    return testInteraction;
  }
  return terminalInteraction();
}

export function rejectSigningBypassFlags(flags = {}) {
  const forbidden = ["yes", "confirm", "passphrase", "password", "private-key", "secret", "token"];
  const found = forbidden.find((name) => Object.prototype.hasOwnProperty.call(flags, name));
  if (found) throw new CliHumanInteractionError(`--${found} is forbidden for human-local signing operations`, "CLI_HUMAN_BYPASS_FORBIDDEN");
}
