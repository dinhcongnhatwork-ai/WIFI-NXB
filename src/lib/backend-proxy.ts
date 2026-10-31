/** Evaluated at request time so one production image serves both process roles. */
export function backendDestination(requestUrl:string,mode:string|undefined,backendUrl:string|undefined):string|null{
 const request=new URL(requestUrl);
 if(mode!=='frontend'||!request.pathname.startsWith('/api/'))return null;
 const backend=new URL(backendUrl||'http://127.0.0.1:3001');
 if(!['http:','https:'].includes(backend.protocol)||backend.username||backend.password||backend.pathname!=='/'||backend.search||backend.hash||backend.origin===request.origin)throw new Error('Cấu hình địa chỉ backend không hợp lệ.');
 backend.pathname=request.pathname;backend.search=request.search;
 return backend.toString();
}
