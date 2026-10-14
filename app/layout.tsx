import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GymDash — Administration',
  description: 'Tableau de bord super-admin GymPass SN',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
