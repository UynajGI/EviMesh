import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Research Content Policy | EviMesh',
  description: 'How EviMesh attributes, corrects, evaluates, and moderates public research objects.',
};

export default function ResearchContentPolicyPage() {
  return <PolicyPage policyKey="researchContent" />;
}
