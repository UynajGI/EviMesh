/**
 * Parse argv into `{ command, positionals, flags }`.
 * Supports `--flag value`, `--flag=value`, and boolean `--flag`.
 */
const BOOLEAN_FLAGS = new Set(["json", "dry-run", "help"]);

export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  let command = null;
  let i = 0;
  // First non-flag token is the command; a second non-flag token group forms positionals.
  for (; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) break;
    if (command === null) command = token;
    else positionals.push(token);
  }
  for (; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const equals = body.indexOf("=");
    if (equals >= 0) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
    } else if (BOOLEAN_FLAGS.has(body)) {
      flags[body] = true;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      flags[body] = argv[i + 1];
      i += 1;
    } else {
      flags[body] = true;
    }
  }
  return { command, positionals, flags };
}

export function flagString(flags, name, fallback = null) {
  const value = flags[name];
  if (value === undefined || value === true || value === null) return fallback;
  return String(value);
}

export function flagBool(flags, name) {
  return flags[name] === true || flags[name] === "true";
}

export function requirePositional(positionals, index, label) {
  const value = positionals[index];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`missing required argument <${label}>`);
  }
  return value;
}
