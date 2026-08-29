import { cn } from '@/lib/utils';

/*
 * ProvenanceList (design book 09 §2.9 / trust layer): the shared
 * hash-signature-parents fold. Hashes stay one layer down (05 global shell
 * contract); the summary line carries the claim, the fold carries the bytes.
 * Used by events, claim detail, and attempt trails so the audit reading
 * pattern is identical everywhere.
 */
export function ProvenanceList({ summary = 'Technical details: hash, signature, parents', fields = [], className }) {
  if (fields.length === 0) return null;
  return (
    <details className={cn('mt-2', className)}>
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">{summary}</summary>
      <dl className="mt-2 grid gap-3 text-sm md:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className={cn('mt-1 break-all', field.mono === false ? 'tabular-nums' : 'font-mono text-xs tabular-nums')}>
              {field.value ?? 'Missing'}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
