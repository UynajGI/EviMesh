import './globals.css';
import { TemplateShell } from '@/components/template-shell';

export const metadata = {
  title: { default: 'EviMesh', template: '%s · EviMesh' },
  description: 'Open distributed scientific network.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TemplateShell>{children}</TemplateShell>
      </body>
    </html>
  );
}
