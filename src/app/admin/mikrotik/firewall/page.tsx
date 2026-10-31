'use client';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { MikrotikAddressList, MikrotikFirewallRule, MikrotikNatRule } from '@/types/mikrotik';
import { formatBytes } from '@/lib/network/format';

interface FirewallResponse {
  filterRules: MikrotikFirewallRule[];
  natRules: MikrotikNatRule[];
  addressLists: MikrotikAddressList[];
}

export default function MikrotikFirewallPage() {
  const [data, setData] = useState<FirewallResponse>({
    filterRules: [],
    natRules: [],
    addressLists: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'filter' | 'nat' | 'address-list'>('filter');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [addNatModal, setAddNatModal] = useState(false);
  const [natForm, setNatForm] = useState({
    chain: 'srcnat',
    natAction: 'masquerade',
    outInterface: 'ether1',
    toAddresses: '',
    toPorts: '',
    dstPort: '',
    protocol: 'tcp',
    comment: '',
  });

  const [addListModal, setAddListModal] = useState(false);
  const [listForm, setListForm] = useState({ list: '', address: '', timeout: '', comment: '' });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/firewall');
      const json = (await res.json()) as { success: boolean; data?: FirewallResponse; error?: string };
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải firewall rules');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải tường lửa RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Actions
  const toggleFilterRule = async (item: MikrotikFirewallRule) => {
    try {
      setActionLoading(item.id);
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.disabled ? 'enable-filter' : 'disable-filter', id: item.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã ${item.disabled ? 'bật' : 'tắt'} filter rule`);
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

  const toggleNatRule = async (item: MikrotikNatRule) => {
    try {
      setActionLoading(item.id);
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.disabled ? 'enable-nat' : 'disable-nat', id: item.id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã ${item.disabled ? 'bật' : 'tắt'} NAT rule`);
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

  const handleAddNat = async () => {
    try {
      setActionLoading('add-nat');
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-nat',
          chain: natForm.chain,
          natAction: natForm.natAction,
          outInterface: natForm.outInterface,
          toAddresses: natForm.toAddresses,
          toPorts: natForm.toPorts,
          dstPort: natForm.dstPort,
          protocol: natForm.protocol,
          comment: natForm.comment,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã thêm NAT Rule thành công');
        setAddNatModal(false);
        setNatForm({
          chain: 'srcnat',
          natAction: 'masquerade',
          outInterface: 'ether1',
          toAddresses: '',
          toPorts: '',
          dstPort: '',
          protocol: 'tcp',
          comment: '',
        });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể tạo NAT rule');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveNat = async (id: string) => {
    if (!confirm('Xóa NAT rule này khỏi tường lửa?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-nat', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa NAT rule');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa NAT rule');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAddressList = async () => {
    if (!listForm.list || !listForm.address) {
      alert('Vui lòng nhập tên danh sách và IP address');
      return;
    }
    try {
      setActionLoading('add-list');
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-address-list', ...listForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã thêm địa chỉ vào Address List');
        setAddListModal(false);
        setListForm({ list: '', address: '', timeout: '', comment: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể thêm');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAddressList = async (id: string) => {
    if (!confirm('Xóa mục này khỏi Address List?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-address-list', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa mục khỏi Address List');
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

  const toggleAddressList = async (item: MikrotikAddressList) => {
    try {
      setActionLoading(item.id);
      const res = await networkFetch('/api/mikrotik/firewall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: item.disabled ? 'enable-address-list' : 'disable-address-list',
          id: item.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã ${item.disabled ? 'bật' : 'tắt'} mục Address List`);
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

  const filteredFilterRules = useMemo(() => {
    const q = search.toLowerCase();
    return data.filterRules.filter(
      (r) =>
        (r.chain || '').toLowerCase().includes(q) ||
        (r.action || '').toLowerCase().includes(q) ||
        (r.protocol || '').toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q) ||
        (r.srcAddress || '').toLowerCase().includes(q) ||
        (r.dstAddress || '').toLowerCase().includes(q)
    );
  }, [data.filterRules, search]);

  const filteredNatRules = useMemo(() => {
    const q = search.toLowerCase();
    return data.natRules.filter(
      (r) =>
        (r.chain || '').toLowerCase().includes(q) ||
        (r.action || '').toLowerCase().includes(q) ||
        (r.toAddresses || '').toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q)
    );
  }, [data.natRules, search]);

  const filteredAddressLists = useMemo(() => {
    const q = search.toLowerCase();
    return data.addressLists.filter(
      (l) => l.list.toLowerCase().includes(q) || l.address.toLowerCase().includes(q) || (l.comment || '').toLowerCase().includes(q)
    );
  }, [data.addressLists, search]);

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tường lửa MikroTik (Firewall)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý Filter Rules, NAT Rules (Masquerade / Port Forwarding) và Address Lists
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
            { id: 'filter', label: `Filter Rules (${data.filterRules.length})` },
            { id: 'nat', label: `NAT Rules (${data.natRules.length})` },
            { id: 'address-list', label: `Address Lists (${data.addressLists.length})` },
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
            placeholder="Tìm kiếm rule, chain, IP, comment..."
            className="w-64 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* TAB 1: FILTER RULES */}
      {activeTab === 'filter' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Bộ lọc tường lửa (Filter Rules)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Kiểm soát các chuỗi Input, Forward và Output</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {filteredFilterRules.length} rules
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Bật/Tắt</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3">Hành động (Action)</th>
                  <th className="px-4 py-3">Giao thức</th>
                  <th className="px-4 py-3">Nguồn (Src IP)</th>
                  <th className="px-4 py-3">Đích (Dst IP)</th>
                  <th className="px-4 py-3">Lưu lượng (Bytes)</th>
                  <th className="px-4 py-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredFilterRules.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 ${item.disabled ? 'opacity-50 bg-slate-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleFilterRule(item)}
                        disabled={actionLoading === item.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans transition-all ${
                          item.disabled
                            ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {item.disabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {item.disabled ? 'DISABLED' : 'ENABLED'}
                      </button>
                    </td>

                    <td className="px-4 py-3 font-bold font-sans">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {item.chain || 'forward'}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.action === 'accept'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.action === 'drop'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {(item.action || 'accept').toUpperCase()}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-sans text-slate-700">{item.protocol || 'any'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.srcAddress || 'any'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.dstAddress || 'any'}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">
                      {item.bytes !== undefined ? formatBytes(item.bytes) : '-'}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-500">{item.comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NAT RULES */}
      {activeTab === 'nat' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Cấu hình NAT (Network Address Translation)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Masquerade ra Internet, mở cổng máy chủ Port Forwarding (dst-nat)
              </p>
            </div>
            <button
              onClick={() => setAddNatModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm NAT Rule
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Bật/Tắt</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3">Hành động NAT</th>
                  <th className="px-4 py-3">Cổng ra (Out Interface)</th>
                  <th className="px-4 py-3">Đến IP / Cổng (To-Addresses)</th>
                  <th className="px-4 py-3">Lưu lượng</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredNatRules.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 ${item.disabled ? 'opacity-50 bg-slate-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleNatRule(item)}
                        disabled={actionLoading === item.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans transition-all ${
                          item.disabled
                            ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {item.disabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {item.disabled ? 'DISABLED' : 'ENABLED'}
                      </button>
                    </td>

                    <td className="px-4 py-3 font-bold font-sans">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {item.chain}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.action === 'masquerade'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.action.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-sans text-slate-700">{item.outInterface || 'all'}</td>
                    <td className="px-4 py-3 text-slate-800 font-bold">
                      {item.toAddresses ? `${item.toAddresses}${item.toPorts ? `:${item.toPorts}` : ''}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">
                      {item.bytes !== undefined ? formatBytes(item.bytes) : '-'}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-500">{item.comment || '-'}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <button
                        onClick={() => handleRemoveNat(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa NAT Rule"
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

      {/* TAB 3: ADDRESS LISTS */}
      {activeTab === 'address-list' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Danh sách địa chỉ IP (Address Lists)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Nhóm IP dùng cho luật tường lửa chặn/cho phép hàng loạt</p>
            </div>
            <button
              onClick={() => setAddListModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm vào Address List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="px-4 py-3">Bật/Tắt</th>
                  <th className="px-4 py-3">Tên Danh sách (List)</th>
                  <th className="px-4 py-3">Địa chỉ IP / Subnet</th>
                  <th className="px-4 py-3">Thời gian Timeout</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAddressLists.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 ${item.disabled ? 'opacity-50 bg-slate-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 font-sans">
                      <button
                        onClick={() => toggleAddressList(item)}
                        disabled={actionLoading === item.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          item.disabled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.disabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {item.disabled ? 'OFF' : 'ON'}
                      </button>
                    </td>

                    <td className="px-4 py-3 font-bold text-blue-700 font-sans">{item.list}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{item.address}</td>
                    <td className="px-4 py-3 text-slate-500">{item.timeout || 'Static / Vĩnh viễn'}</td>
                    <td className="px-4 py-3 font-sans text-slate-400">{item.comment || '-'}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <button
                        onClick={() => handleRemoveAddressList(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa khỏi list"
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

      {/* Add NAT Rule Modal */}
      <AnimatePresence>
        {addNatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddNatModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm NAT Rule vào RouterOS</h3>
                <button onClick={() => setAddNatModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Chain</label>
                  <select
                    value={natForm.chain}
                    onChange={(e) => setNatForm({ ...natForm, chain: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="srcnat">srcnat (Ra Internet / Masquerade)</option>
                    <option value="dstnat">dstnat (Mở cổng Port Forwarding)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Hành động (Action)</label>
                  <select
                    value={natForm.natAction}
                    onChange={(e) => setNatForm({ ...natForm, natAction: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="masquerade">masquerade (Chia sẻ IP WAN)</option>
                    <option value="dst-nat">dst-nat (Chuyển tiếp đến IP máy chủ)</option>
                    <option value="src-nat">src-nat</option>
                    <option value="redirect">redirect (Chuyển hướng cổng)</option>
                  </select>
                </div>

                {natForm.natAction === 'dst-nat' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">To Addresses</label>
                      <input
                        type="text"
                        value={natForm.toAddresses}
                        onChange={(e) => setNatForm({ ...natForm, toAddresses: e.target.value })}
                        placeholder="VD: 192.168.1.100"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">To Ports</label>
                      <input
                        type="text"
                        value={natForm.toPorts}
                        onChange={(e) => setNatForm({ ...natForm, toPorts: e.target.value })}
                        placeholder="VD: 80, 443"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Out Interface (Cổng ra WAN)</label>
                  <input
                    type="text"
                    value={natForm.outInterface}
                    onChange={(e) => setNatForm({ ...natForm, outInterface: e.target.value })}
                    placeholder="VD: ether1, pppoe-out1..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={natForm.comment}
                    onChange={(e) => setNatForm({ ...natForm, comment: e.target.value })}
                    placeholder="VD: NAT Internet cho mạng nội bộ"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddNatModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddNat}
                    disabled={actionLoading === 'add-nat'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Thêm NAT Rule
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Address List Modal */}
      <AnimatePresence>
        {addListModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddListModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm vào Address List</h3>
                <button onClick={() => setAddListModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên Danh Sách (List Name)</label>
                  <input
                    type="text"
                    value={listForm.list}
                    onChange={(e) => setListForm({ ...listForm, list: e.target.value })}
                    placeholder="VD: blocked-ips, vip-clients, bypass-portal"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ IP hoặc Subnet</label>
                  <input
                    type="text"
                    value={listForm.address}
                    onChange={(e) => setListForm({ ...listForm, address: e.target.value })}
                    placeholder="VD: 192.168.1.50 hoặc 10.0.0.0/8"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={listForm.comment}
                    onChange={(e) => setListForm({ ...listForm, comment: e.target.value })}
                    placeholder="VD: Thiết bị lãnh đạo"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddListModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddAddressList}
                    disabled={actionLoading === 'add-list'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Thêm vào List
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
