import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function EvidenceDetailPage({ params }) { const { evidenceId } = await params; return <ResearchObjectDetail collection="evidence" id={evidenceId} type="evidence" />; }
