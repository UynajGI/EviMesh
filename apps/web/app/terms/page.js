import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Terms | EviMesh',
  description: 'The operating terms for using EviMesh during Public Preview.',
};

export default function TermsPage() {
  return <PolicyPage policyKey="terms" />;
}
