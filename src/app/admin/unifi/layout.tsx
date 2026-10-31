import { Suspense } from 'react';
import NetworkShell from '@/components/network/NetworkShell';
export default function UnifiLayout({children}:{children:React.ReactNode}){return <Suspense fallback={<p>Loading network…</p>}><NetworkShell provider="unifi">{children}</NetworkShell></Suspense>;}
