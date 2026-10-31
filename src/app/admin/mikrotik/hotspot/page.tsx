'use client';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio,
  Plus,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Wifi,
  Users,
  UserX,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  Sliders,
  Layers,
} from 'lucide-react';
import type {
  MikrotikHotspotActiveSession,
  MikrotikHotspotProfile,
  MikrotikHotspotServer,
  MikrotikHotspotUser,
  MikrotikHotspotUserProfile,
  MikrotikIpBinding,
} from '@/types/mikrotik';
import { formatBytes } from '@/lib/network/format';

interface HotspotResponse {
  profiles: MikrotikHotspotProfile[];
  userProfiles: MikrotikHotspotUserProfile[];
  servers: MikrotikHotspotServer[];
  users: MikrotikHotspotUser[];
  active: MikrotikHotspotActiveSession[];
  bindings: MikrotikIpBinding[];
}

export default function MikrotikHotspotPage() {
  const [data, setData] = useState<HotspotResponse>({
    profiles: [],
    userProfiles: [],
    servers: [],
    users: [],
    active: [],
    bindings: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'bindings' | 'users' | 'profiles'>('active');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [addUserModal, setAddUserModal] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    password: '',
    profile: 'default',
    server: 'all',
    comment: '',
  });

  const [addBindingModal, setAddBindingModal] = useState(false);
  const [bindingForm, setBindingForm] = useState({
    macAddress: '',
    address: '',
    type: 'bypassed',
    comment: '',
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/hotspot');
      const json = (await res.json()) as { success: boolean; data?: HotspotResponse; error?: string };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải dữ liệu Hotspot');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối Hotspot RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Actions
  const handleKickActive = async (session: MikrotikHotspotActiveSession) => {
    if (!confirm(`Ngắt kết nối (Kick) người dùng ${session.user || session.macAddress}?`)) return;
    try {
      setActionLoading(session.id);
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick-active', id: session.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã ngắt phiên kết nối Hotspot');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể kick session');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUser = async () => {
    if (!userForm.name) {
      alert('Vui lòng nhập username');
      return;
    }
    try {
      setActionLoading('add-user');
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-user', ...userForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã tạo Hotspot User thành công');
        setAddUserModal(false);
        setUserForm({ name: '', password: '', profile: 'default', server: 'all', comment: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể tạo user');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUser = async (user: MikrotikHotspotUser) => {
    try {
      setActionLoading(user.id);
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: user.disabled ? 'enable-user' : 'disable-user', id: user.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã ${user.disabled ? 'bật' : 'tắt'} user`);
        await fetchData();
      } else {
        showToast('error', json.error || 'Cập nhật thất bại');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveUser = async (id: string) => {
    if (!confirm('Xóa tài khoản Hotspot user này?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-user', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa tài khoản user');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa user');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddBinding = async () => {
    if (!bindingForm.macAddress && !bindingForm.address) {
      alert('Vui lòng nhập địa chỉ MAC hoặc IP để binding');
      return;
    }
    try {
      setActionLoading('add-binding');
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-binding', ...bindingForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã tạo IP Binding loại ${bindingForm.type}`);
        setAddBindingModal(false);
        setBindingForm({ macAddress: '', address: '', type: 'bypassed', comment: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể tạo binding');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveBinding = async (id: string) => {
    if (!confirm('Xóa mục IP Binding này?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/hotspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-binding', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa IP Binding');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredActive = useMemo(() => {
    const q = search.toLowerCase();
    return data.active.filter(
      (a) =>
        (a.user || '').toLowerCase().includes(q) ||
        (a.address || '').includes(q) ||
        (a.macAddress || '').toLowerCase().includes(q)
    );
  }, [data.active, search]);

  const filteredBindings = useMemo(() => {
    const q = search.toLowerCase();
    return data.bindings.filter(
      (b) =>
        (b.macAddress || '').toLowerCase().includes(q) ||
        (b.address || '').includes(q) ||
        (b.comment || '').toLowerCase().includes(q)
    );
  }, [data.bindings, search]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return data.users.filter(
      (u) => u.name.toLowerCase().includes(q) || (u.comment || '').toLowerCase().includes(q)
    );
  }, [data.users, search]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-16">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${
              toastMsg.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 backdrop-blur-md'
                : 'bg-rose-950/90 text-rose-200 border-rose-500/40 backdrop-blur-md'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MikroTik Hotspot</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý phiên đăng nhập WiFi Marketing, IP Bindings (Bypass / Chặn) và tài khoản Hotspot RouterOS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          {[
            { id: 'active', label: `Đang kết nối (${data.active.length})` },
            { id: 'bindings', label: `IP Bindings (${data.bindings.length})` },
            { id: 'users', label: `Hotspot Users (${data.users.length})` },
            { id: 'profiles', label: `User Profiles (${data.userProfiles.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearch('');
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm user, IP, MAC..."
            className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* TAB 1: ACTIVE SESSIONS */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Phiên đang kết nối (Active Sessions)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các thiết bị đã xác thực qua trang chào WiFi Marketing hoặc đăng nhập tài khoản
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
              {filteredActive.length} đang Online
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="px-4 py-3">Người dùng / Client</th>
                  <th className="px-4 py-3">Địa chỉ IP</th>
                  <th className="px-4 py-3">Địa chỉ MAC</th>
                  <th className="px-4 py-3">Phương thức Login</th>
                  <th className="px-4 py-3">Thời gian Online</th>
                  <th className="px-4 py-3">Tải về / Tải lên</th>
                  <th className="px-4 py-3 text-center">Ngắt kết nối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActive.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-900 font-sans">{item.user || 'Guest'}</td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">{item.address}</td>
                    <td className="px-4 py-3 text-slate-500">{item.macAddress}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                        {item.loginBy || 'http-chap'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-600">{item.uptime || '-'}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="text-sky-600 font-semibold">↓{formatBytes(item.bytesOut || 0)}</span>
                      {' / '}
                      <span className="text-emerald-600 font-semibold">↑{formatBytes(item.bytesIn || 0)}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <button
                        onClick={() => handleKickActive(item)}
                        disabled={actionLoading === item.id}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-semibold transition-colors flex items-center gap-1 mx-auto"
                        title="Kick session này"
                      >
                        <UserX size={12} /> Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredActive.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              Hiện tại không có phiên Hotspot nào đang hoạt động
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IP BINDINGS */}
      {activeTab === 'bindings' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Danh sách IP Bindings (Bypass & Block)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Thiết bị bỏ qua trang chào (Bypassed) hoặc bị chặn vĩnh viễn (Blocked) theo MAC/IP
              </p>
            </div>
            <button
              onClick={() => setAddBindingModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm IP Binding
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="px-5 py-3">Địa chỉ MAC</th>
                  <th className="px-5 py-3">Địa chỉ IP</th>
                  <th className="px-5 py-3">Loại Binding</th>
                  <th className="px-5 py-3">Server</th>
                  <th className="px-5 py-3">Ghi chú</th>
                  <th className="px-5 py-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBindings.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{item.macAddress || 'Bất kỳ (Any)'}</td>
                    <td className="px-5 py-3.5 text-slate-700">{item.address || 'Bất kỳ (Any)'}</td>
                    <td className="px-5 py-3.5 font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.type === 'bypassed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : item.type === 'blocked'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.type === 'bypassed' && <ShieldCheck size={12} />}
                        {item.type === 'blocked' && <ShieldAlert size={12} />}
                        {(item.type || 'regular').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-sans text-slate-500">{item.server || 'all'}</td>
                    <td className="px-5 py-3.5 font-sans text-slate-400">{item.comment || '-'}</td>
                    <td className="px-5 py-3.5 text-center font-sans">
                      <button
                        onClick={() => handleRemoveBinding(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa Binding"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBindings.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              Chưa có cấu hình IP Binding nào
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HOTSPOT USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Danh sách tài khoản Hotspot Users</h3>
              <p className="text-xs text-slate-400 mt-0.5">Tài khoản xác thực lưu trực tiếp trên RouterOS</p>
            </div>
            <button
              onClick={() => setAddUserModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Tạo Hotspot User
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Bật/Tắt</th>
                  <th className="px-4 py-3">Tên đăng nhập (Username)</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Giới hạn thời gian (Limit Uptime)</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 ${item.disabled ? 'opacity-50 bg-slate-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleUser(item)}
                        disabled={actionLoading === item.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          item.disabled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.disabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {item.disabled ? 'OFF' : 'ON'}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold font-mono text-[11px]">
                        {item.profile || 'default'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.server || 'all'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.limitUptime || 'Không giới hạn'}</td>
                    <td className="px-4 py-3 text-slate-400">{item.comment || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveUser(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: USER PROFILES */}
      {activeTab === 'profiles' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Hồ sơ người dùng (User Profiles)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cấu hình giới hạn tốc độ băng thông (Rate Limit), số thiết bị dùng chung (Shared Users)
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {data.userProfiles.length} Profiles
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Tên Profile</th>
                  <th className="px-5 py-3">Giới hạn tốc độ (Rate Limit)</th>
                  <th className="px-5 py-3">Dùng chung (Shared Users)</th>
                  <th className="px-5 py-3">Session Timeout</th>
                  <th className="px-5 py-3">Idle Timeout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.userProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{p.name}</td>
                    <td className="px-5 py-3.5 font-mono text-emerald-700 font-bold">
                      {p.rateLimit || 'Không giới hạn'}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700">{p.sharedUsers || 1}</td>
                    <td className="px-5 py-3.5 text-slate-500">{p.sessionTimeout || 'none'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{p.idleTimeout || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Hotspot User Modal */}
      <AnimatePresence>
        {addUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Tạo tài khoản Hotspot User</h3>
                <button onClick={() => setAddUserModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên đăng nhập (Username)</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="VD: guest01, vip_guest..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Mật khẩu (Password)</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Nhập mật khẩu (để trống nếu không cần)"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Profile</label>
                  <select
                    value={userForm.profile}
                    onChange={(e) => setUserForm({ ...userForm, profile: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="default">default</option>
                    {data.userProfiles.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={userForm.comment}
                    onChange={(e) => setUserForm({ ...userForm, comment: e.target.value })}
                    placeholder="VD: Khách hội nghị"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddUserModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={actionLoading === 'add-user'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Tạo tài khoản
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add IP Binding Modal */}
      <AnimatePresence>
        {addBindingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddBindingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm IP Binding vào Hotspot</h3>
                <button onClick={() => setAddBindingModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Loại Binding (Type)</label>
                  <select
                    value={bindingForm.type}
                    onChange={(e) => setBindingForm({ ...bindingForm, type: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="bypassed">bypassed (Bỏ qua trang đăng nhập / Tự do vào mạng)</option>
                    <option value="blocked">blocked (Chặn thiết bị không cho vào mạng)</option>
                    <option value="regular">regular (Bình thường / Phải qua trang đăng nhập)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ MAC</label>
                  <input
                    type="text"
                    value={bindingForm.macAddress}
                    onChange={(e) => setBindingForm({ ...bindingForm, macAddress: e.target.value })}
                    placeholder="VD: 78:8A:20:F0:E8:4F"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ IP (Tùy chọn)</label>
                  <input
                    type="text"
                    value={bindingForm.address}
                    onChange={(e) => setBindingForm({ ...bindingForm, address: e.target.value })}
                    placeholder="VD: 192.168.1.150"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={bindingForm.comment}
                    onChange={(e) => setBindingForm({ ...bindingForm, comment: e.target.value })}
                    placeholder="VD: VIP - Máy sếp không cần xem quảng cáo"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddBindingModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddBinding}
                    disabled={actionLoading === 'add-binding'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Thêm Binding
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
