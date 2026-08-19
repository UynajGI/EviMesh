'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, CardHeader, Metadata, StatusBadge } from '@/components/ui/data';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Alert, Empty, Progress, Skeleton } from '@/components/ui/feedback';
import { Input, Label, Textarea } from '@/components/ui/form';
import { IdChip } from '@/components/ui/idchip';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Checkbox, Radio, Select, Switch } from '@/components/ui/selection';
import { Tooltip } from '@/components/ui/tooltip';
import { ChangeItem, ChangeGroup } from '@/components/change-item';
import { RoleBar } from '@/components/role-bar';

function Showcase({ title, description, children }) {
  return <section aria-labelledby={title.replaceAll(' ', '-').toLowerCase()}>
    <h2 id={title.replaceAll(' ', '-').toLowerCase()} className="text-lg font-semibold">{title}</h2>
    {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-5">{children}</div>
  </section>;
}

export default function DesignCatalogPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return <PageContainer wide><PageHeader eyebrow="Design system" title="Component catalog" description="Every primitive and its states, rendered on semantic tokens. Screenshots of this page are the visual regression baseline." />
    <div className="mt-12 space-y-12">
      <Showcase title="Buttons" description="Six variants plus loading and disabled states.">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Showcase>
      <Showcase title="Badges" description="Six status variants; color never carries meaning alone.">
        <Badge>Default</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="info">Info</Badge>
      </Showcase>
      <Showcase title="Protocol status badges" description="M13.8 dual-tier and emphasis variants with per-state icons; text always leads.">
        <StatusBadge state="hypothesis" />
        <StatusBadge state="under_verification" />
        <StatusBadge state="provisionally_accepted" />
        <StatusBadge state="accepted" />
        <StatusBadge state="contested" />
        <StatusBadge state="refuted" />
        <StatusBadge state="superseded" />
        <StatusBadge state="retracted" />
        <StatusBadge state="dependency_tainted" />
        <StatusBadge state="supports" />
        <StatusBadge state="refutes" />
        <StatusBadge state="qualifies" />
        <StatusBadge state="reproduces" />
        <StatusBadge state="investigating" />
        <StatusBadge state="critical" />
        <StatusBadge state="attention" />
        <StatusBadge state="update" />
        <StatusBadge state="quiet" />
      </Showcase>
      <Showcase title="Stable id chips" description="Truncated mono values with one-click copy and feedback.">
        <IdChip value="claim_0192b1c7-88e2-5d14-b0a7-1c9f3e8d2b60" />
        <IdChip label="question" value="question_0192a8f3-6d21-7c4e-9f3a-2b8d1e6c4a90" />
      </Showcase>
      <Showcase title="Change items" description="Awareness-stream rows: level-tinted icon circle, what, why, basis. Attention priority, never a verdict.">
        <div className="grid w-full gap-0 divide-y divide-border">
          <ChangeItem href="/home" id="claim_0193a02f-11b8-4e0a-9d2c-6f1b5a8e3c77" idLabel="claim" level="attention" meta={<StatusBadge state="contested" />} time="37m ago" what="Claim entered contested" why="A challenge is investigating measurement leakage; downstream use premises may shift." />
          <ChangeItem id="question_0192a8f3-6d21" idLabel="question" level="update" meta={<StatusBadge state="active_question" />} time="2h ago" what="Open question seeking answers" why="Its research contract and frontier membership live in the six-view workspace." />
          <ChangeItem id="frontier_0193b4d1" idLabel="snapshot" level="frontier" time="1d ago" what="Frontier snapshot published" why="Snapshots are immutable once published." />
        </div>
      </Showcase>
      <Showcase title="Role distribution" description="Count-only bars for contribution roles; never points or rankings.">
        <RoleBar className="w-full max-w-md" counts={{ originator: 12, contributor: 31, reviewer: 9, verifier: 14, witness: 3, maintainer: 2 }} />
      </Showcase>
      <Showcase title="Form fields" description="Text entry with explicit focus and invalid states.">
        <div className="grid gap-3"><div className="grid gap-1"><Label htmlFor="catalog-text">Text input</Label><Input id="catalog-text" placeholder="Placeholder" /></div><div className="grid gap-1"><Label htmlFor="catalog-area">Textarea</Label><Textarea id="catalog-area" className="min-h-20" placeholder="Long-form input" /></div></div>
      </Showcase>
      <Showcase title="Selection" description="Native controls for keyboard and screen-reader semantics.">
        <label className="flex items-center gap-2 text-sm"><Checkbox defaultChecked /> Checkbox</label>
        <label className="flex items-center gap-2 text-sm"><Radio name="catalog-radio" defaultChecked /> Radio</label>
        <Select defaultValue="one"><option value="one">One</option><option value="two">Two</option></Select>
        <label className="flex items-center gap-2 text-sm"><Switch defaultChecked /> Switch</label>
      </Showcase>
      <Showcase title="Feedback" description="Recovery, progress, and status surfaces.">
        <Alert variant="info" title="Info" description="Informational notice." />
        <Alert variant="success" title="Success" description="Operation completed." />
        <Alert variant="warning" title="Warning" description="Proceed with care." />
        <Alert variant="destructive" title="Destructive" description="Irreversible action." />
        <div className="w-48"><Progress value={60} /></div>
        <Skeleton className="h-4 w-32" />
      </Showcase>
      <Showcase title="Data" description="Quiet card surfaces and tabular metadata.">
        <Card className="w-64"><CardHeader title="Card title" description="Supporting text" /><CardContent><Metadata items={[{ label: 'Snapshot', value: 'sha256:…' }, { label: 'Events', value: '42' }]} /></CardContent></Card>
      </Showcase>
      <Showcase title="Overlays" description="Focus-managed dialog and dependency-free tooltip.">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger><DialogContent><h2 className="text-base font-semibold">Dialog</h2><p className="mt-2 text-sm text-muted-foreground">Focus moves into the dialog and returns on close.</p><div className="mt-6 flex justify-end"><Button onClick={() => setDialogOpen(false)}>Close</Button></div></DialogContent></Dialog>
        <Tooltip label="Keyboard reachable"><Button variant="ghost">Hover for tooltip</Button></Tooltip>
      </Showcase>
      <Showcase title="Empty states" description="Dashed surface with a recovery path.">
        <Empty title="Nothing here yet" description="Items will appear here as data accumulates." className="w-full" />
      </Showcase>
      <SectionHeader title="Regression baseline" action={<span className="text-sm text-muted-foreground">Desktop 1440px + mobile 390px</span>} />
    </div>
  </PageContainer>;
}
