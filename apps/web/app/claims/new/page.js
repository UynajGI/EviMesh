import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewClaimPage() {
  return <ResearchWriteHandoff command="sq claim create --out ./claim.json" description="Claims are immutable signed revisions. The website exposes their attributable record without collecting drafts or signatures." eyebrow="Claim authoring" kind="claim" />;
}
