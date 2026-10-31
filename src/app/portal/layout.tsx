import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'WiFi Portal',
  description: 'Connect to free WiFi',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
