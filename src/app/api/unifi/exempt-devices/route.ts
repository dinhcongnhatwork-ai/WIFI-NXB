import {withPermission} from '@/lib/api-access';
import {createApprovedDevices,exemptError,listApprovedDevices} from '@/lib/network/unifi-exempt-api';
export const dynamic='force-dynamic';
export const GET=withPermission('read',async req=>{try{return await listApprovedDevices(req);}catch(error){return exemptError(error);}});
export const POST=withPermission('admin',async req=>{try{return await createApprovedDevices(req);}catch(error){return exemptError(error);}});
