/** Print a result either as stable JSON (for agents) or human-readable text. */
export function emit({ json = false }, data, human) {
  if (json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  } else if (typeof human === "function") {
    const text = human(data);
    if (typeof text === "string" && text.length > 0) process.stdout.write(`${text}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  }
}

export function fail({ json = false }, error) {
  const code = error?.code ?? "CLI_ERROR";
  const message = error?.message ?? String(error);
  if (json) {
    process.stderr.write(`${JSON.stringify({ error: { code, message } }, null, 2)}\n`);
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
}

export function formatTable(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) return "(none)";
  const header = columns.map((column) => column.label);
  const widths = header.map((label, index) => Math.max(
    label.length,
    ...rows.map((row) => String(columns[index].value(row) ?? "").length),
  ));
  const line = (cells) => cells.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ").trimEnd();
  return [line(header), ...rows.map((row) => line(columns.map((column) => column.value(row))))].join("\n");
}
