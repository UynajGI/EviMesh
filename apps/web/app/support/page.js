import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Support | EviMesh',
  description: 'Current Public Preview routes for account, research content, security, and policy support.',
};

export default function SupportPage() {
  return <PolicyPage policyKey="support" />;
}
