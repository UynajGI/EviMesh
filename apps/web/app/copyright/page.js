import { PolicyPage } from '@/app/privacy/policy-page';

export const metadata = {
  title: 'Copyright and Illegal Content | EviMesh',
  description: 'How to report material that may be unlawful, infringing, or unsafe to distribute.',
};

export default function CopyrightPage() {
  return <PolicyPage policyKey="copyright" />;
}
