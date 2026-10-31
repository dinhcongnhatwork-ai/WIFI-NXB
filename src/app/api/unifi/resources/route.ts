import { resourceHandlers } from '@/lib/network/resource-api';
export const dynamic = 'force-dynamic';
export const { GET, POST } = resourceHandlers('unifi');
