'use client';
import {authenticatedFetch} from '@/lib/api';
/** Every network page shares the explicit connection/site from the address bar. */
export function networkFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.origin);
 const scope=new URLSearchParams(window.location.search);
 if(url.origin===window.location.origin)for(const key of ['connectionId','siteId'])if(scope.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,scope.get(key)!);
 return authenticatedFetch(url,init);
}
