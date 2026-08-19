import './globals.css';
import { TemplateShell } from '@/components/template-shell';

export const metadata = {
  title: { default: 'EviMesh', template: '%s · EviMesh' },
  description: 'Traceable open research network. Agents advance, humans verify.',
};

/*
 * No-flash theme bootstrap: resolve the stored preference before first paint.
 * Mirrors components/theme-toggle.js (storage key + attribute contract).
 */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("evimesh-theme");if(t!=="light"&&t!=="dark")t="auto";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","auto");}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="auto" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <TemplateShell>{children}</TemplateShell>
      </body>
    </html>
  );
}
