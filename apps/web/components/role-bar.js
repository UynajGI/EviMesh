import { cn } from '@/lib/utils';

/*
 * Role distribution bar (design book 06 §1 / 05 §4): compact count-only bar
 * for contribution roles. Counts, never scores; the numeric legend always
 * renders next to the bar so color carries no meaning alone.
 */
export const CONTRIBUTION_ROLES = ['originator', 'contributor', 'reviewer', 'verifier', 'witness', 'maintainer'];

const ROLE_COLOR = {
  originator: 'bg-series-1',
  contributor: 'bg-series-3',
  reviewer: 'bg-series-6',
  verifier: 'bg-series-5',
  witness: 'bg-series-7',
  maintainer: 'bg-series-2',
};

export function RoleBar({ counts, className }) {
  const total = CONTRIBUTION_ROLES.reduce((sum, role) => sum + (counts?.[role] ?? 0), 0);
  return (
    <div aria-label={`Contribution roles: ${CONTRIBUTION_ROLES.map((role) => `${role} ${counts?.[role] ?? 0}`).join(', ')}`} className={cn('rolebar max-w-md', className)} role="img">
      <div
        aria-hidden="true"
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        {total > 0 ? CONTRIBUTION_ROLES.map((role) => {
          const value = counts?.[role] ?? 0;
          if (!value) return null;
          return <span aria-hidden="true" className={cn('rolebar__seg h-full', `rolebar__seg--${role}`, ROLE_COLOR[role])} key={role} style={{ width: `${(value / total) * 100}%` }} />;
        }) : <span className="h-full w-full" />}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {CONTRIBUTION_ROLES.map((role) => (
          <div className="flex items-center gap-1.5" key={role}>
            <span aria-hidden="true" className={cn('size-2 rounded-full', ROLE_COLOR[role])} />
            <dt className="sr-only">{role}</dt>
            <dd className="tabular-nums">{role} {counts?.[role] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
