import { Suspense } from 'react';
import NetworkShell from '@/components/network/NetworkShell';
export default function MikrotikLayout({children}:{children:React.ReactNode}){return <Suspense fallback={<p>Loading network…</p>}><NetworkShell provider="mikrotik">{children}</NetworkShell></Suspense>;}
