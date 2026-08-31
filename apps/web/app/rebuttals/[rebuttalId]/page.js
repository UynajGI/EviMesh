import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function RebuttalDetailPage({ params }) { const { rebuttalId } = await params; return <ResearchObjectDetail collection="rebuttals" id={rebuttalId} type="rebuttal" />; }
