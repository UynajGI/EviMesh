import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Acceptable Use | EviMesh',
  description: 'Conduct, research integrity, automation, and infrastructure boundaries for EviMesh.',
};

export default function AcceptableUsePage() {
  return <PolicyPage policyKey="acceptableUse" />;
}
