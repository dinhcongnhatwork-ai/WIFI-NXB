import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WiFi Portal',
  description: 'Connect to free WiFi',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
