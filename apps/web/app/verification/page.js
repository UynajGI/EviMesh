import { SectionPlaceholder } from '@/components/section-placeholder';
import { ClaimDag } from '@/components/claim-dag';

const sampleElements = [
  { data: { id: 'evidence', label: 'Evidence' } },
  { data: { id: 'claim', label: 'Claim' } },
  { data: { id: 'verification', label: 'Verify' } },
  { data: { id: 'evidence-claim', source: 'evidence', target: 'claim' } },
  { data: { id: 'claim-verification', source: 'claim', target: 'verification' } },
];

export default function VerificationPage() {
  return <><SectionPlaceholder eyebrow="Trust layer" title="Verification" description="Review evidence, verification receipts, and the current confidence of the shared record." /><section className="mx-auto max-w-6xl px-6 pb-20"><ClaimDag elements={sampleElements} /></section></>;
}
