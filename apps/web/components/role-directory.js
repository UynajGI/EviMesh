import { cn } from '@/lib/utils';

export const CONTRIBUTION_ROLES = ['originator', 'contributor', 'reviewer', 'verifier', 'witness', 'maintainer'];

/*
 * Public contribution roles are categorical context. Keep this surface
 * textual so visual length never encodes magnitude between people or roles.
 */
export function RoleDirectory({ className, roles = [] }) {
  const uniqueRoles = [...new Set(roles.map((role) => (typeof role === 'string' ? role : role?.role)).filter(Boolean))];
  return (
    <ul className={cn('role-directory grid max-w-md divide-y divide-border border-y border-border', className)}>
      {uniqueRoles.map((role) => (
        <li className="flex min-h-10 items-center justify-between gap-4 py-2 text-sm" key={role}>
          <span className="font-medium text-foreground">{role}</span>
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">recorded role</span>
        </li>
      ))}
    </ul>
  );
}
