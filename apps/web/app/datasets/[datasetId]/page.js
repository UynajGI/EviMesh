import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function DatasetDetailPage({ params }) { const { datasetId } = await params; return <ResearchObjectDetail collection="datasets" id={datasetId} type="dataset" />; }
