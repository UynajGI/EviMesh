import { PolicyPage } from './policy-page';

export const metadata = {
  title: 'Privacy | EviMesh',
  description: 'How EviMesh processes account, security, identity, and public research data during Public Preview.',
};

export default function PrivacyPage() {
  return <PolicyPage policyKey="privacy" />;
}
