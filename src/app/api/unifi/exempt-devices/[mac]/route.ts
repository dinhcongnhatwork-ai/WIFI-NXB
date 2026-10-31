import {NextRequest} from 'next/server';
import {withPermission} from '@/lib/api-access';
import {changeApprovedDevice,exemptError} from '@/lib/network/unifi-exempt-api';
export const dynamic='force-dynamic';
type Context={params:{mac:string}};
export const PUT=withPermission('admin',async(req:NextRequest,{params}:Context)=>{try{return await changeApprovedDevice(req,params.mac);}catch(error){return exemptError(error);}});
export const DELETE=withPermission('admin',async(req:NextRequest,{params}:Context)=>{try{return await changeApprovedDevice(req,params.mac,true);}catch(error){return exemptError(error);}});
