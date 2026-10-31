'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { LogIn, Network } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    try { await login(username.trim(), password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đăng nhập. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }

  return <main className="admin-login">
    <div className="admin-login-brand"><Image src="/logo.png" alt="" width={40} height={40} priority /><div><strong>WiFi Marketing</strong><span>Hệ thống quản trị mạng và truy cập</span></div></div>
    <section className="admin-login-card" aria-labelledby="login-heading">
      <div className="admin-login-symbol"><Network aria-hidden="true" /></div>
      <h1 id="login-heading">Đăng nhập quản trị</h1>
      <p>Sử dụng tài khoản được cấp để truy cập hệ thống.</p>
      <form onSubmit={handleSubmit} aria-busy={loading}>
        <div><label htmlFor="admin-username">Tên đăng nhập</label><input id="admin-username" name="username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required autoCapitalize="none" spellCheck={false} disabled={loading} /></div>
        <div><label htmlFor="admin-password">Mật khẩu</label><input id="admin-password" name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required disabled={loading} aria-describedby={error ? 'login-error' : undefined} /></div>
        {error && <p id="login-error" role="alert" className="admin-error">{error}</p>}
        <button type="submit" className="admin-button admin-button-primary" disabled={loading}><LogIn aria-hidden="true" />{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </section>
    <p className="admin-login-footer">WiFi Marketing · Cổng quản trị nội bộ</p>
  </main>;
}
