import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/navigation/Footer';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SmartTrip AI — Intelligent, Budget-Aware Travel Planning Platform',
  description: 'Plan your perfect trip with SmartTrip AI. Tell us your budget, time, starting point and interests, and we will build a realistic, optimized itinerary around your constraints.',
  keywords: ['travel planner', 'budget travel', 'AI travel', 'itinerary generator', 'travel optimization', 'route planning'],
  authors: [{ name: 'SmartTrip AI' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="antialiased min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}