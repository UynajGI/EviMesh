/*
 * OAuth provider brand marks (design book 06: provider buttons carry the
 * official marks — brand assets, separate from the lucide UI icon family;
 * 06 §ORCID hard-compliance mandates the official iD mark in production).
 */

/** Official GitHub octocat mark (github.com brand asset), currentColor. */
export function GithubMark({ size = 18, className }) {
  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 16 16" width={size} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** Official Google "G" mark with its fixed four-color palette. */
export function GoogleMark({ size = 18, className }) {
  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 18 18" width={size}>
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z" fill="#FBBC05" />
      <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

/** Official ORCID iD mark: fixed green disc, white iD. */
export function OrcidMark({ size = 18, className }) {
  return (
    <svg aria-hidden="true" className={className} height={size} viewBox="0 0 256 256" width={size}>
      <circle cx="128" cy="128" fill="#A6CE39" r="128" />
      <text dominantBaseline="central" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontSize="118" fontWeight="700" textAnchor="middle" x="128" y="134">iD</text>
    </svg>
  );
}
