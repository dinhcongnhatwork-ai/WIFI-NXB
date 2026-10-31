'use client';
import { networkFetch } from '@/components/network/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Gauge,
  Sliders,
} from 'lucide-react';
import type { MikrotikSimpleQueue } from '@/types/mikrotik';
import { formatBytes } from '@/lib/network/format';

export default function MikrotikQueuesPage() {
  const [queues, setQueues] = useState<MikrotikSimpleQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Queue Modal
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    target: '',
    maxUpload: '10M',
    maxDownload: '20M',
    comment: '',
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchQueues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await networkFetch('/api/mikrotik/queues');
      const json = await res.json();
      if (json.success) {
        setQueues(json.data || []);
      } else {
        setError(json.error || 'Không thể tải danh sách Queues');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối RouterOS');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueues();
  }, [fetchQueues]);

  const toggleQueue = async (q: MikrotikSimpleQueue) => {
    try {
      setActionLoading(q.id);
      const res = await networkFetch('/api/mikrotik/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id: q.id, disabled: !q.disabled }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Đã ${q.disabled ? 'kích hoạt' : 'tắt'} giới hạn băng thông`);
        await fetchQueues();
      } else {
        showToast('error', json.error || 'Cập nhật thất bại');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveQueue = async (id: string) => {
    if (!confirm('Xóa hàng đợi giới hạn băng thông này?')) return;
    try {
      setActionLoading(id);
      const res = await networkFetch('/api/mikrotik/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã xóa Simple Queue');
        await fetchQueues();
      } else {
        showToast('error', json.error || 'Không thể xóa');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddQueue = async () => {
    if (!form.name || !form.target) {
      alert('Vui lòng nhập tên queue và target IP/Subnet');
      return;
    }
    const maxLimit = `${form.maxUpload}/${form.maxDownload}`;
    try {
      setActionLoading('add');
      const res = await networkFetch('/api/mikrotik/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: form.name,
          target: form.target,
          maxLimit,
          comment: form.comment,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Đã tạo Simple Queue thành công trên RouterOS');
        setAddModal(false);
        setForm({ name: '', target: '', maxUpload: '10M', maxDownload: '20M', comment: '' });
        await fetchQueues();
      } else {
        showToast('error', json.error || 'Không thể tạo queue');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredQueues = useMemo(() => {
    const q = search.toLowerCase();
    return queues.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.target || '').toLowerCase().includes(q) ||
        (item.comment || '').toLowerCase().includes(q)
    );
  }, [queues, search]);

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quản lý băng thông (Simple Queues)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Giới hạn tốc độ Download / Upload theo địa chỉ IP hoặc dải mạng Subnet trên RouterOS
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchQueues()}
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

      {/* Table & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên queue, IP target..."
              className="w-64 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => setAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all"
          >
            <Plus size={14} /> Thêm giới hạn băng thông
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 font-sans">
              <tr>
                <th className="px-5 py-3.5">Bật/Tắt</th>
                <th className="px-5 py-3.5">Tên Hàng Đợi (Queue Name)</th>
                <th className="px-5 py-3.5">Đối tượng (Target IP/Subnet)</th>
                <th className="px-5 py-3.5">Giới hạn Max (Upload / Download)</th>
                <th className="px-5 py-3.5">Lưu lượng truyền tải</th>
                <th className="px-5 py-3.5">Ghi chú</th>
                <th className="px-5 py-3.5 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQueues.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50/80 ${item.disabled ? 'opacity-50 bg-slate-50/40' : ''}`}
                >
                  <td className="px-5 py-3.5 font-sans">
                    <button
                      onClick={() => toggleQueue(item)}
                      disabled={actionLoading === item.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        item.disabled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.disabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                      {item.disabled ? 'OFF' : 'ON'}
                    </button>
                  </td>

                  <td className="px-5 py-3.5 font-bold text-slate-900 font-sans">{item.name}</td>
                  <td className="px-5 py-3.5 font-bold text-blue-700">{item.target}</td>
                  <td className="px-5 py-3.5 font-bold text-emerald-700">
                    {item.maxLimit ? `${item.maxLimit} (Up/Down)` : 'Không giới hạn'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{item.bytes || '-'}</td>
                  <td className="px-5 py-3.5 font-sans text-slate-400">{item.comment || '-'}</td>
                  <td className="px-5 py-3.5 text-center font-sans">
                    <button
                      onClick={() => handleRemoveQueue(item.id)}
                      disabled={actionLoading === item.id}
                      className="p-1 rounded text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Xóa Queue"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredQueues.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-xs">
            Chưa có luật giới hạn băng thông nào được tạo
          </div>
        )}
      </div>

      {/* Add Queue Modal */}
      <AnimatePresence>
        {addModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Thêm Simple Queue giới hạn tốc độ</h3>
                <button onClick={() => setAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên Hàng Đợi (Queue Name)</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: limit-guest, pc-ke-toan..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Target IP / Subnet</label>
                  <input
                    type="text"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    placeholder="VD: 192.168.1.50/32 hoặc 10.10.1.0/24"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Tải lên Max (Upload)</label>
                    <select
                      value={form.maxUpload}
                      onChange={(e) => setForm({ ...form, maxUpload: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="2M">2 Mbps</option>
                      <option value="5M">5 Mbps</option>
                      <option value="10M">10 Mbps</option>
                      <option value="20M">20 Mbps</option>
                      <option value="50M">50 Mbps</option>
                      <option value="100M">100 Mbps</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Tải về Max (Download)</label>
                    <select
                      value={form.maxDownload}
                      onChange={(e) => setForm({ ...form, maxDownload: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="5M">5 Mbps</option>
                      <option value="10M">10 Mbps</option>
                      <option value="20M">20 Mbps</option>
                      <option value="30M">30 Mbps</option>
                      <option value="50M">50 Mbps</option>
                      <option value="100M">100 Mbps</option>
                      <option value="200M">200 Mbps</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder="VD: Giới hạn khách vãng lai"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAddModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddQueue}
                    disabled={actionLoading === 'add'}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    Tạo Queue
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
