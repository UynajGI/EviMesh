import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Governance | EviMesh',
  description: 'The Public Preview charter for community decisions, conflicts, appeals, and emergency platform action.',
};

export default function GovernancePage() {
  return <PolicyPage policyKey="governance" />;
}
