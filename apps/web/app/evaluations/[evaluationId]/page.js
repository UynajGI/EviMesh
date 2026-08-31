import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function EvaluationDetailPage({ params }) { const { evaluationId } = await params; return <ResearchObjectDetail collection="evaluations" id={evaluationId} type="evaluation" />; }
