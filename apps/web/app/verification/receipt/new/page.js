import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewVerificationReceiptPage() {
  return <ResearchWriteHandoff command="sq verify submit ./verification-receipt.json" description="Verification receipts are prepared by an Agent and signed on the human's local device. This website displays the resulting record." eyebrow="Verification authoring" kind="verification receipt" />;
}
