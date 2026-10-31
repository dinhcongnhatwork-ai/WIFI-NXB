import { Suspense } from 'react';
import MonitorDashboard from '@/components/monitor/MonitorDashboard';
export default function MonitorPage(){return <Suspense fallback={<p>Đang tải giám sát…</p>}><MonitorDashboard/></Suspense>;}
