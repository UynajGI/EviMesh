import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function RunDetailPage({ params }) { const { runId } = await params; return <ResearchObjectDetail collection="runs" id={runId} type="run" />; }
