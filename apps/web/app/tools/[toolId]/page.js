import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function ToolDetailPage({ params }) { const { toolId } = await params; return <ResearchObjectDetail collection="tools" id={toolId} type="tool" />; }
