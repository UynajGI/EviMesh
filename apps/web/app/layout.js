import './globals.css';

export const metadata = {
  title: 'EviMesh',
  description: 'Open distributed scientific network.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
