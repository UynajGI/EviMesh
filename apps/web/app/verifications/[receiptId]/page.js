import { ResearchObjectDetail } from '@/components/research-object-detail';
export default async function VerificationReceiptDetailPage({ params }) { const { receiptId } = await params; return <ResearchObjectDetail collection="verifications" id={receiptId} type="verification_receipt" />; }
