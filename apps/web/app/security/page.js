import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Security | EviMesh',
  description: 'How to report vulnerabilities and understand EviMesh signing and access boundaries.',
};

export default function SecurityPage() {
  return <PolicyPage policyKey="security" />;
}
