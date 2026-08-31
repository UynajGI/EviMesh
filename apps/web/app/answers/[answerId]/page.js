import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function AnswerDetailPage({ params }) { const { answerId } = await params; return <ResearchObjectDetail collection="answers" id={answerId} type="answer" />; }
