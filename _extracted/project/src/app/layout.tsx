import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'CKTONLINE — Enterprise Console',
  description: 'CKTONLINE full-stack lifecycle gap-closure package',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          background: '#f5f6f8',
          color: '#1f2933',
        }}
      >
        {children}
      </body>
    </html>
  );
}
