const environment = process.argv[2] ?? "development";
const originVariable = environment === "production"
  ? "EVIMESH_WEB_PRODUCTION_ORIGIN"
  : environment === "development"
    ? "EVIMESH_WEB_DEV_ORIGIN"
    : null;

if (!originVariable) {
  console.error("Usage: node scripts/render-r2-cors.mjs development|production");
  process.exit(2);
}

const origin = process.env[originVariable];
if (!origin) {
  console.error(`${originVariable} is required`);
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(origin);
} catch {
  console.error(`${originVariable} must be a valid HTTPS origin`);
  process.exit(1);
}

if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
  console.error(`${originVariable} must be an HTTPS origin without a path, query, or fragment`);
  process.exit(1);
}

console.log(JSON.stringify([{
  AllowedOrigins: [parsed.origin],
  AllowedMethods: ["GET", "HEAD", "PUT"],
  AllowedHeaders: ["Content-Type"],
  ExposeHeaders: ["ETag"],
  MaxAgeSeconds: 3600,
}], null, 2));
