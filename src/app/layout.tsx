import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cubit Connect | AI Knowledge Distillation",
  description: "Turn chaotic video and text into actionable, step-by-step documentation. Local-first, private, and powered by Gemini.",
  openGraph: {
    title: "Cubit Connect | AI Knowledge Distillation",
    description: "Turn chaotic video and text into actionable, step-by-step documentation. Local-first, private, and powered by Gemini.",
    type: "website",
  },
};

import ErrorBoundary from '@/components/ErrorBoundary';
import { GlobalErrorListener } from '@/components/GlobalErrorListener';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';

// ... existing imports ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <GlobalErrorListener />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
