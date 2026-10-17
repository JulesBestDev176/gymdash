import type { Metadata } from 'next';
import { Outfit, DM_Mono, Unbounded } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-brand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GymDash — Administration',
  description: 'Tableau de bord super-admin GymPass SN',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${outfit.variable} ${dmMono.variable} ${unbounded.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
