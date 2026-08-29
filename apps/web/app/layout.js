import './globals.css';
import { TemplateShell } from '@/components/template-shell';

export const metadata = {
  title: { default: 'EviMesh', template: '%s · EviMesh' },
  description: 'Traceable open research network. Agents advance, humans verify.',
};

/*
 * No-flash theme bootstrap: resolve the stored preference before first paint.
 * "auto" is resolved to the concrete system value here, and kept live on
 * system changes, so the stylesheet only needs one dark token block
 * ([data-theme="dark"]) with no prefers-color-scheme duplicate. Mirrors
 * components/theme-toggle.js (storage key + attribute contract).
 */
const THEME_BOOTSTRAP = `(function(){
try{
var m=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)"):null;
function apply(){try{var t=localStorage.getItem("evimesh-theme");if(t!=="light"&&t!=="dark")t=(m&&m.matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme",(m&&m.matches)?"dark":"light");}}
apply();
if(m&&m.addEventListener)m.addEventListener("change",function(){try{if(localStorage.getItem("evimesh-theme")!=="light"&&localStorage.getItem("evimesh-theme")!=="dark")apply();}catch(e){apply();}});
}catch(e){document.documentElement.setAttribute("data-theme","dark");}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <TemplateShell>{children}</TemplateShell>
      </body>
    </html>
  );
}
