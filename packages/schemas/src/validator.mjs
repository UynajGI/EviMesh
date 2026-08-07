/**
 * Minimal JSON Schema validator covering the subset used by the EviMesh
 * protocol schemas (const, enum, pattern, length/range bounds, items,
 * required properties, additionalProperties: false, $defs references).
 */

function typeName(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, type) {
  if (Array.isArray(type)) return type.some((option) => matchesType(value, option));
  const actual = typeName(value);
  if (type === "number") return actual === "number" || actual === "integer";
  return actual === type;
}

function resolveRef(schema, root) {
  const ref = schema.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/")) {
    throw new TypeError(`unsupported $ref: ${ref}`);
  }
  let current = root;
  for (const part of ref.slice(2).split("/")) {
    current = current?.[part];
    if (current === undefined) throw new TypeError(`cannot resolve $ref: ${ref}`);
  }
  return current;
}

function check(schema, value, root, path, findings) {
  if (schema.$ref) {
    check(resolveRef(schema, root), value, root, path, findings);
    return;
  }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    findings.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
    findings.push({ path, message: `must be one of ${schema.enum.join(", ")}` });
    return;
  }
  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    findings.push({ path, message: `must be of type ${schema.type}` });
    return;
  }
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) findings.push({ path, message: `must be at least ${schema.minLength} characters` });
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) findings.push({ path, message: `must be at most ${schema.maxLength} characters` });
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) findings.push({ path, message: `must match pattern ${schema.pattern}` });
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) findings.push({ path, message: "must be an ISO-8601 date-time" });
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) findings.push({ path, message: `must be >= ${schema.minimum}` });
    if (typeof schema.maximum === "number" && value > schema.maximum) findings.push({ path, message: `must be <= ${schema.maximum}` });
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) findings.push({ path, message: `must contain at least ${schema.minItems} items` });
    if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) findings.push({ path, message: "must contain unique items" });
    if (schema.items) value.forEach((item, index) => check(schema.items, item, root, `${path}[${index}]`, findings));
  }
  if (typeName(value) === "object") {
    if (typeof schema.minProperties === "number" && Object.keys(value).length < schema.minProperties) {
      findings.push({ path, message: `must define at least ${schema.minProperties} properties` });
    }
    for (const required of schema.required ?? []) {
      if (!(required in value) || value[required] === undefined) findings.push({ path: path ? `${path}.${required}` : required, message: "is required" });
    }
    for (const [key, propertyValue] of Object.entries(value)) {
      const propertySchema = schema.properties?.[key];
      if (propertySchema) {
        check(propertySchema, propertyValue, root, path ? `${path}.${key}` : key, findings);
      } else if (schema.additionalProperties === false) {
        findings.push({ path: path ? `${path}.${key}` : key, message: "is not an allowed property" });
      }
    }
  }
}

/** Validate one document against one schema; returns `{ valid, findings }`. */
export function validateAgainstSchema(schema, document) {
  if (!schema || typeof schema !== "object") throw new TypeError("schema must be an object");
  const findings = [];
  check(schema, document, schema, "", findings);
  return Object.freeze({ valid: findings.length === 0, findings: Object.freeze(findings) });
}

const DOCUMENT_SCHEMA_FILES = Object.freeze({
  "srp.claim.v1": "claim.schema.json",
  "srp.task.v1": "task.schema.json",
  "srp.question.v1": "question.schema.json",
  "srp.project.v1": "project.schema.json",
  "srp.run.v1": "run.schema.json",
  "srp.artifact.v1": "artifact.schema.json",
  "srp.event.v1": "event.schema.json",
  "srp.challenge.v1": "challenge.schema.json",
  "srp.verification-receipt.v1": "verification.schema.json",
  "srp.contribution.v1": "contribution.schema.json",
  "srp.frontier.v1": "frontier.schema.json",
});

/** Map a document's `schema` discriminator to its schema file name. */
export function schemaFileForDocument(document) {
  const discriminator = document?.schema;
  if (typeof discriminator !== "string" || !(discriminator in DOCUMENT_SCHEMA_FILES)) return null;
  return DOCUMENT_SCHEMA_FILES[discriminator];
}
