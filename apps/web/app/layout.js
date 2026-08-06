import './globals.css';
import { SiteNav } from '@/components/site-nav';

export const metadata = {
  title: 'EviMesh',
  description: 'Open distributed scientific network.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
