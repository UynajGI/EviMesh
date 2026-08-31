import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewEvidencePage() {
  return <ResearchWriteHandoff command="sq evidence add ./artifact.bin" description="Evidence is bound to immutable Artifact and Run references outside the public reading surface." eyebrow="Evidence authoring" kind="evidence" />;
}
