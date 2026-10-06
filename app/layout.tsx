import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { appDescription, appName, appTagline } from '@/lib/shared';
import './global.css';

export const metadata: Metadata = {
  title: {
    template: `%s | ${appName}`,
    default: `${appName}: ${appTagline}`,
  },
  description: appDescription,
};

export const viewport: Viewport = {
  themeColor: '#100f0e',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
