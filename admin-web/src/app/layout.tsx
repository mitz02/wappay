import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WAPPay Administration | Banking Operations & Audit',
  description: 'Internal platform administration, reconciliation, and audit management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
