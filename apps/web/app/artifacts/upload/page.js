import { ArtifactUploadPanel } from '@/components/artifact-upload-panel';
import { PageContainer, PageHeader } from '@/components/ui/page';

export default function ArtifactUploadPage() {
  return <PageContainer><PageHeader eyebrow="Evidence graph" title="Artifact upload" description="Hash a file locally and upload it to R2 through a short-lived signed URL." /><ArtifactUploadPanel /></PageContainer>;
}
