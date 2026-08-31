import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function ArtifactUploadPage() {
  return <ResearchWriteHandoff command="sq evidence add ./artifact.bin" description="Files are hashed and transferred by the local CLI or Agent connection. The public website does not receive research uploads." eyebrow="Artifact authoring" kind="artifact" title="Upload through your Agent" />;
}
