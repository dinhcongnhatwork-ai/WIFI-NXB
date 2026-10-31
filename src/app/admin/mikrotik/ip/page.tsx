'use client';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Search,
  Server,
  Cable,
  CheckCircle2,
  Layers,
  Check,
  Pin,
  Clock,
  ArrowRight,
  X,
  AlertTriangle,
} from 'lucide-react';
import type {
  MikrotikArpEntry,
  MikrotikDhcpLease,
  MikrotikDhcpServer,
  MikrotikIpAddress,
  MikrotikIpPool,
  MikrotikRoute,
} from '@/types/mikrotik';

interface IpResponse {
  addresses: MikrotikIpAddress[];
  dhcpServers: MikrotikDhcpServer[];
  dhcpLeases: MikrotikDhcpLease[];
  routes: MikrotikRoute[];
  arp: MikrotikArpEntry[];
  pools: MikrotikIpPool[];
}

export default function MikrotikIpPage() {
  const [data, setData] = useState<IpResponse>({
    addresses: [],
    dhcpServers: [],
    dhcpLeases: [],
    routes: [],
    arp: [],
    pools: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'addresses' | 'leases' | 'arp' | 'pools' | 'routes'>('addresses');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [addAddressModal, setAddAddressModal] = useState(false);
  const [addressForm, setAddressForm] = useState({ address: '', interface: 'ether1', comment: '' });

  const [addLeaseModal, setAddLeaseModal] = useState(false);
  const [leaseForm, setLeaseForm] = useState({ address: '', macAddress: '', server: 'all', comment: '' });

  const [addPoolModal, setAddPoolModal] = useState(false);
  const [poolForm, setPoolForm] = useState({ name: '', ranges: '' });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/ip');
      const json = (await res.json()) as { success: boolean; data?: IpResponse; error?: string };

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Không thể tải dữ liệu IP từ RouterOS');
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối IP RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Actions
  const handleMakeLeaseStatic = async (leaseId: string) => {
    try {
      setActionLoading(leaseId);
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'make-lease-static', id: leaseId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã chuyển thành static lease thành công');
        await fetchData();
      } else {
        showToast('error', json.error || 'Thao tác thất bại');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveLease = async (leaseId: string) => {
    if (!confirm('Xóa DHCP lease này?')) return;
    try {
      setActionLoading(leaseId);
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-lease', id: leaseId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa DHCP lease');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa lease');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAddress = async () => {
    if (!addressForm.address || !addressForm.interface) {
      alert('Vui lòng nhập IP address (VD: 192.168.1.1/24) và interface');
      return;
    }
    try {
      setActionLoading('add-address');
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-address', ...addressForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã thêm IP Address vào RouterOS');
        setAddAddressModal(false);
        setAddressForm({ address: '', interface: 'ether1', comment: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể thêm IP');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAddress = async (id: string) => {
    if (!confirm('Xóa IP Address này khỏi router?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-address', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa IP Address');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa IP');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveArp = async (id: string) => {
    if (!confirm('Xóa mục ARP này khỏi bảng ARP cache?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-arp', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa ARP entry');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa ARP entry');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPool = async () => {
    if (!poolForm.name || !poolForm.ranges) {
      alert('Vui lòng nhập tên pool và dải IP');
      return;
    }
    try {
      setActionLoading('add-pool');
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-pool', ...poolForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã tạo IP Pool thành công');
        setAddPoolModal(false);
        setPoolForm({ name: '', ranges: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể tạo IP Pool');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePool = async (id: string) => {
    if (!confirm('Xóa IP Pool này?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-pool', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa IP Pool');
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể xóa pool');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddLease = async () => {
    if (!leaseForm.address || !leaseForm.macAddress) {
      alert('Vui lòng nhập IP và MAC address');
      return;
    }
    try {
      setActionLoading('add-lease');
      const res = await networkFetch('/api/mikrotik/ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-lease', ...leaseForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã tạo Static DHCP Lease');
        setAddLeaseModal(false);
        setLeaseForm({ address: '', macAddress: '', server: 'all', comment: '' });
        await fetchData();
      } else {
        showToast('error', json.error || 'Không thể tạo lease');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAddresses = useMemo(() => {
    const q = search.toLowerCase();
    return data.addresses.filter(
      (a) => a.address.toLowerCase().includes(q) || (a.interface && a.interface.toLowerCase().includes(q))
    );
  }, [data.addresses, search]);

  const filteredLeases = useMemo(() => {
    const q = search.toLowerCase();
    return data.dhcpLeases.filter(
      (l) =>
        (l.address && l.address.includes(q)) ||
        (l.macAddress && l.macAddress.toLowerCase().includes(q)) ||
        (l.hostName && l.hostName.toLowerCase().includes(q))
    );
  }, [data.dhcpLeases, search]);

  const filteredArp = useMemo(() => {
    const q = search.toLowerCase();
    return data.arp.filter(
      (a) =>
        a.address.includes(q) ||
        (a.macAddress && a.macAddress.toLowerCase().includes(q)) ||
        a.interface.toLowerCase().includes(q)
    );
  }, [data.arp, search]);

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IP & DHCP RouterOS</h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý địa chỉ IP, DHCP Server/Leases, bảng ARP Cache và IP Pools chuẩn RouterOS
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
            { id: 'addresses', label: `IP Addresses (${data.addresses.length})` },
            { id: 'leases', label: `DHCP Leases (${data.dhcpLeases.length})` },
            { id: 'arp', label: `Bảng ARP (${data.arp.length})` },
            { id: 'pools', label: `IP Pools (${data.pools.length})` },
            { id: 'routes', label: `Định tuyến (${data.routes.length})` },
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
            placeholder="Tìm kiếm IP, MAC, hostname..."
            className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* TAB 1: IP ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Danh sách IP Address trên các Interface</h3>
            <button
              onClick={() => setAddAddressModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm IP Address
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Địa chỉ IP / Subnet</th>
                  <th className="px-5 py-3">Network</th>
                  <th className="px-5 py-3">Cổng (Interface)</th>
                  <th className="px-5 py-3">Loại</th>
                  <th className="px-5 py-3">Ghi chú</th>
                  <th className="px-5 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredAddresses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{item.address}</td>
                    <td className="px-5 py-3.5 text-slate-600">{item.network || '-'}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold font-sans">
                        {item.interface || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.dynamic ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.dynamic ? 'DYNAMIC' : 'STATIC'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-sans text-slate-500">{item.comment || '-'}</td>
                    <td className="px-5 py-3.5 text-center font-sans">
                      <button
                        onClick={() => handleRemoveAddress(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1.5 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa IP"
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

      {/* TAB 2: DHCP LEASES */}
      {activeTab === 'leases' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Danh sách DHCP Server Leases</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các IP được DHCP server cấp phát cho client kèm MAC và Hostname
              </p>
            </div>
            <button
              onClick={() => setAddLeaseModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm Static Lease
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">IP Được cấp</th>
                  <th className="px-4 py-3">MAC Address</th>
                  <th className="px-4 py-3">Hostname</th>
                  <th className="px-4 py-3">DHCP Server</th>
                  <th className="px-4 py-3">Loại Lease</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hết hạn sau</th>
                  <th className="px-4 py-3 text-center">Thao tác RouterOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredLeases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.address}</td>
                    <td className="px-4 py-3 text-slate-600">{item.macAddress}</td>
                    <td className="px-4 py-3 font-sans text-slate-800 font-medium">
                      {item.hostName || '-'}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-500">{item.server || 'dhcp1'}</td>
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.dynamic
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {item.dynamic ? 'DYNAMIC' : 'STATIC'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        {item.status || 'bound'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.expiresAfter || '-'}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1">
                        {item.dynamic && (
                          <button
                            onClick={() => handleMakeLeaseStatic(item.id)}
                            disabled={actionLoading === item.id}
                            className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition-colors flex items-center gap-1"
                            title="Chuyển sang Static Lease cố định IP"
                          >
                            <Pin size={12} /> Make Static
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveLease(item.id)}
                          disabled={actionLoading === item.id}
                          className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa Lease"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ARP TABLE */}
      {activeTab === 'arp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Bảng ánh xạ ARP (Address Resolution Protocol)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ánh xạ phần cứng MAC ↔ IP thời gian thực trên các cổng router
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {filteredArp.length} mục ARP
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Địa chỉ IP</th>
                  <th className="px-5 py-3">Địa chỉ MAC</th>
                  <th className="px-5 py-3">Cổng (Interface)</th>
                  <th className="px-5 py-3">Trạng thái ARP</th>
                  <th className="px-5 py-3">Ghi chú</th>
                  <th className="px-5 py-3 text-center">Xóa ARP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredArp.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-bold text-slate-900">{item.address}</td>
                    <td className="px-5 py-3 text-slate-700">{item.macAddress || '-'}</td>
                    <td className="px-5 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                        {item.interface}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.dynamic ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.dynamic ? 'DYNAMIC' : 'STATIC'}
                        </span>
                        {item.complete && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            COMPLETE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-sans text-slate-400">{item.comment || '-'}</td>
                    <td className="px-5 py-3 text-center font-sans">
                      <button
                        onClick={() => handleRemoveArp(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa khỏi ARP cache"
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

      {/* TAB 4: IP POOLS */}
      {activeTab === 'pools' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Dải cấp phát IP (IP Pools)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Dải IP cung cấp cho DHCP Server và Hotspot</p>
            </div>
            <button
              onClick={() => setAddPoolModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              <Plus size={14} /> Thêm IP Pool
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Tên Pool</th>
                  <th className="px-5 py-3">Dải địa chỉ (Ranges)</th>
                  <th className="px-5 py-3">Tổng số IP</th>
                  <th className="px-5 py-3">Đã sử dụng</th>
                  <th className="px-5 py-3">Còn khả dụng</th>
                  <th className="px-5 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pools.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-bold text-slate-900">{item.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-700 font-semibold">{item.ranges}</td>
                    <td className="px-5 py-3 font-bold text-slate-800">{item.total || '-'}</td>
                    <td className="px-5 py-3 font-bold text-amber-600">{item.used || 0}</td>
                    <td className="px-5 py-3 font-bold text-emerald-600">{item.available || '-'}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => handleRemovePool(item.id)}
                        disabled={actionLoading === item.id}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Xóa Pool"
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

      {/* TAB 5: ROUTES */}
      {activeTab === 'routes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Bảng định tuyến RouterOS (Routing Table)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Các tuyến đường IP định tuyến ra Internet & mạng nội bộ</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {data.routes.length} tuyến đường
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="px-5 py-3">Địa chỉ đích (Dst Address)</th>
                  <th className="px-5 py-3">Gateway</th>
                  <th className="px-5 py-3">Distance</th>
                  <th className="px-5 py-3">Routing Table</th>
                  <th className="px-5 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.routes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 font-bold text-slate-900">{item.dstAddress || '0.0.0.0/0'}</td>
                    <td className="px-5 py-3 text-emerald-700 font-bold">{item.gateway || '-'}</td>
                    <td className="px-5 py-3 text-slate-600">{item.distance ?? 1}</td>
                    <td className="px-5 py-3 font-sans text-slate-500">{item.routingTable || 'main'}</td>
                    <td className="px-5 py-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        {item.active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            ACTIVE
                          </span>
                        )}
                        {item.dynamic && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                            DYNAMIC
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Address Modal */}
      <AnimatePresence>
        {addAddressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddAddressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm IP Address vào RouterOS</h3>
                <button onClick={() => setAddAddressModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">IP Address & Subnet</label>
                  <input
                    type="text"
                    value={addressForm.address}
                    onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                    placeholder="VD: 192.168.10.1/24"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Interface</label>
                  <input
                    type="text"
                    value={addressForm.interface}
                    onChange={(e) => setAddressForm({ ...addressForm, interface: e.target.value })}
                    placeholder="VD: ether1, ether2, bridge..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={addressForm.comment}
                    onChange={(e) => setAddressForm({ ...addressForm, comment: e.target.value })}
                    placeholder="VD: LAN Văn Phòng"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddAddressModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddAddress}
                    disabled={actionLoading === 'add-address'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Thêm IP
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Static Lease Modal */}
      <AnimatePresence>
        {addLeaseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddLeaseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm Static DHCP Lease</h3>
                <button onClick={() => setAddLeaseModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ IP Cố Định</label>
                  <input
                    type="text"
                    value={leaseForm.address}
                    onChange={(e) => setLeaseForm({ ...leaseForm, address: e.target.value })}
                    placeholder="VD: 192.168.1.150"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ MAC</label>
                  <input
                    type="text"
                    value={leaseForm.macAddress}
                    onChange={(e) => setLeaseForm({ ...leaseForm, macAddress: e.target.value })}
                    placeholder="VD: 00:11:22:33:44:55"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú thiết bị</label>
                  <input
                    type="text"
                    value={leaseForm.comment}
                    onChange={(e) => setLeaseForm({ ...leaseForm, comment: e.target.value })}
                    placeholder="VD: Máy in phòng họp, Máy chủ NAS"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddLeaseModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddLease}
                    disabled={actionLoading === 'add-lease'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Tạo Static Lease
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Pool Modal */}
      <AnimatePresence>
        {addPoolModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddPoolModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm IP Pool mới</h3>
                <button onClick={() => setAddPoolModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên Pool</label>
                  <input
                    type="text"
                    value={poolForm.name}
                    onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                    placeholder="VD: pool-guest, pool-lan2"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Dải IP (Ranges)</label>
                  <input
                    type="text"
                    value={poolForm.ranges}
                    onChange={(e) => setPoolForm({ ...poolForm, ranges: e.target.value })}
                    placeholder="VD: 192.168.10.10-192.168.10.250"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddPoolModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddPool}
                    disabled={actionLoading === 'add-pool'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Tạo Pool
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
