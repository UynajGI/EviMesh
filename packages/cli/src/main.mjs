import { parseArgs } from "./args.mjs";
import * as output from "./output.mjs";
import { configInit, authLogin, identityGenerate } from "./commands-setup.mjs";
import { projectList, questionList, taskList, taskInspect, provenance } from "./commands-read.mjs";
import { contextPull, attemptStart } from "./commands-context.mjs";
import { claimCreate, runRecord, evidenceAdd, validate, submit, challengeCreate } from "./commands-write.mjs";
import { verifyCheckout, verifySubmit, bundleVerify } from "./commands-verify.mjs";

const COMMANDS = Object.freeze({
  "config init": { run: configInit, summary: "Write the CLI configuration file" },
  "auth login": { run: authLogin, summary: "Authenticate and store a limited API token" },
  "identity generate": { run: identityGenerate, summary: "Generate an Ed25519 signing identity" },
  "project list": { run: projectList, summary: "List projects" },
  "question list": { run: questionList, summary: "List open questions (supports --field/--state/--project)" },
  "task list": { run: taskList, summary: "List tasks (supports --status/--tag/--type)" },
  "task inspect": { run: taskInspect, summary: "Show one task with dependencies and leases" },
  "context pull": { run: contextPull, summary: "Download and hash-verify one Task ContextBundle" },
  "attempt start": { run: attemptStart, summary: "Start an Attempt with a local workspace" },
  "claim create": { run: claimCreate, summary: "Write a Claim draft template" },
  "run record": { run: runRecord, summary: "Write a Run receipt template" },
  "evidence add": { run: evidenceAdd, summary: "Hash a file and upload it directly to object storage" },
  "challenge create": { run: challengeCreate, summary: "Submit a Challenge from a draft document" },
  validate: { run: validate, summary: "Validate one protocol document locally" },
  submit: { run: submit, summary: "Sign and submit one Claim/Run/Challenge document" },
  "verify checkout": { run: verifyCheckout, summary: "Lock a ClaimRevision and fetch the Blind Context" },
  "verify submit": { run: verifySubmit, summary: "Sign and submit one VerificationReceipt" },
  "bundle verify": { run: bundleVerify, summary: "Offline-verify hashes, signatures, and proofs in a bundle" },
  provenance: { run: provenance, summary: "Show the contribution and dependency path for one revision" },
});

export const HELP_TEXT = `sq — EviMesh research network CLI

Usage: sq <command> [subcommand] [arguments] [flags]

Commands:
${Object.entries(COMMANDS).map(([name, entry]) => `  ${name.padEnd(18)} ${entry.summary}`).join("\n")}

Global flags:
  --json               Emit stable JSON output (every command)
  --dry-run            Print the canonical payload without sending (write commands)
  --api-url <url>      Override the configured API base URL
  --token <token>      Use an explicit bearer token
  --help               Show this help

Configuration lives in ~/.evimesh (override with EVIMESH_CONFIG_DIR).
Run \`sq config init\` first, then \`sq auth login\` or \`sq identity generate\`.
`;

function resolveCommand(command, positionals) {
  if (!command || command === "help" || command === "--help") return { name: "help", rest: positionals };
  // Two-word commands: `sq task list` -> "task list".
  const compound = positionals.length > 0 ? `${command} ${positionals[0]}` : null;
  if (compound && COMMANDS[compound]) return { name: compound, rest: positionals.slice(1) };
  if (COMMANDS[command]) return { name: command, rest: positionals };
  return { name: null, rest: positionals };
}

export async function runCli(argv, { env = process.env, fetchImpl } = {}) {
  const io = {
    emit: (options, data, human) => output.emit(options, data, human),
  };
  const { command, positionals, flags } = parseArgs(argv);
  const resolved = resolveCommand(command, positionals);
  if (resolved.name === "help" || flags.help === true) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (!resolved.name) {
    output.fail({ json: flags.json === true }, new Error(`unknown command: ${command ?? ""}`));
    process.stderr.write(HELP_TEXT);
    return 2;
  }
  const entry = COMMANDS[resolved.name];
  try {
    return await entry.run({ flags, positionals: resolved.rest, output: io, env, fetchImpl }) ?? 0;
  } catch (error) {
    output.fail({ json: flags.json === true }, error);
    return 1;
  }
}
