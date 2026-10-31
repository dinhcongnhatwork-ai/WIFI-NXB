const BASE_URL = '';

interface FetchOptions extends RequestInit {
  token?: string;
}

/** Shared transport for JSON APIs and network pages, including HTTP LAN sessions. */
export function authenticatedFetch(input:string|URL,init:RequestInit={},token?:string):Promise<Response>{
  const headers=new Headers(init.headers);
  let sessionToken=token;
  if(!sessionToken&&!headers.has('Authorization')&&typeof window!=='undefined'){
    const url=new URL(input,window.location.origin);
    if(url.origin===window.location.origin&&url.pathname.startsWith('/api/')&&url.pathname!=='/api/auth/login'){
      try{sessionToken=window.localStorage.getItem('token')||undefined;}catch{}
    }
  }
  if(sessionToken)headers.set('Authorization',`Bearer ${sessionToken}`);
  return fetch(input,{...init,headers,credentials:init.credentials||'same-origin'});
}

function clearClientSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.dispatchEvent(new Event('auth:unauthorized'));
}

async function fetchApi<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await authenticatedFetch(`${BASE_URL}${url}`, {
    ...init,
    headers,
    credentials: 'include',
  },token);

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (url.includes('/api/auth/login')) {
        throw new Error(data.error === 'Invalid credentials' ? 'Tên đăng nhập hoặc mật khẩu không chính xác.' : (data.error || 'Đăng nhập thất bại.'));
      }
      clearClientSession();
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  get: <T>(url: string, token?: string) =>
    fetchApi<T>(url, { method: 'GET', token }),

  post: <T>(url: string, body?: unknown, token?: string) =>
    fetchApi<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      token,
    }),

  put: <T>(url: string, body?: unknown, token?: string) =>
    fetchApi<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      token,
    }),

  delete: <T>(url: string, token?: string) =>
    fetchApi<T>(url, { method: 'DELETE', token }),

  upload: <T>(url: string, formData: FormData, token?: string) =>
    fetchApi<T>(url, {
      method: 'POST',
      body: formData,
      token,
    }),
};
