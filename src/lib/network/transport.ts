import https from 'node:https';
/** Certificate bypass is scoped to this HTTPS request; never alter process TLS policy. */
export async function deviceFetch(url:string,init:RequestInit={},allowInvalidCertificate=false):Promise<Response>{
 // A legacy global bypass must never override this connection's verified policy.
 if(!url.startsWith('https://') || (!allowInvalidCertificate && process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0'))return fetch(url,init);
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method:init.method||'GET',headers:Object.fromEntries(new Headers(init.headers).entries()),rejectUnauthorized:!allowInvalidCertificate,signal:init.signal||undefined},response=>{
   if(response.statusCode&&response.statusCode>=300&&response.statusCode<400){response.resume();reject(new Error('Device redirects are not allowed'));return;}
   const chunks:Buffer[]=[];let size=0;
   response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>20*1024*1024){request.destroy(new Error('Device response exceeds size limit'));return;}chunks.push(chunk);});
   response.on('error',reject);response.on('end',()=>{const headers=new Headers();for(const [key,value]of Object.entries(response.headers)){if(Array.isArray(value))value.forEach(v=>headers.append(key,v));else if(value!==undefined)headers.set(key,value);}const status=response.statusCode||502;resolve(new Response(status===204||status===205||status===304?null:Buffer.concat(chunks),{status,headers}));});
  });
  request.on('error',reject);
  if(init.body!==undefined&&init.body!==null){if(typeof init.body!=='string'){request.destroy(new Error('Unsupported device request body'));return;}request.write(init.body);}
  request.end();
 });
}
