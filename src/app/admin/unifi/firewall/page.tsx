'use client';
import { networkFetch } from '@/components/network/client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  Globe,
  Lock,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from 'lucide-react';

interface FirewallRule {
  _id: string;
  name: string;
  enabled: boolean;
  action: string;
  ruleset?: string;
  src_ip?: string;
  src_cidr?: string;
  src_port?: string;
  dst_ip?: string;
  dst_cidr?: string;
  dst_port?: string;
  protocols?: string[];
  logging?: boolean;
}

interface PortForward {
  _id: string;
  name: string;
  enabled: boolean;
  src_ip?: string;
  src_port: string;
  dst_ip: string;
  dst_port: string;
  protocol: string;
  log?: boolean;
}

export default function UnifiFirewallPage() {
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'portforwards'>('rules');
  const [createModal, setCreateModal] = useState(false);
  const [fwFormData, setFwFormData] = useState({
    name: '',
    action: 'accept',
    ruleset: 'WAN',
    src_ip: 'any',
    src_port: '',
    dst_ip: 'any',
    dst_port: '',
    protocols: ['tcp'] as string[],
    logging: false,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [fwRes, pfRes] = await Promise.all([
        networkFetch('/api/unifi/settings?type=firewall'),
        networkFetch('/api/unifi/settings?type=portforwards'),
      ]);

      const [fwJson, pfJson] = await Promise.all([fwRes.json(), pfRes.json()]);

      if (fwJson.success) {
        setFirewallRules(fwJson.data);
      }
      if (pfJson.success) {
        setPortForwards(pfJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateFirewallRule = async () => {
    try {
      const res = await networkFetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'firewall',
          action: 'create',
          name: fwFormData.name,
          ruleset: fwFormData.ruleset,
          src_ip: fwFormData.src_ip,
          src_port: fwFormData.src_port,
          dst_ip: fwFormData.dst_ip,
          dst_port: fwFormData.dst_port,
          protocols: fwFormData.protocols,
          logging: fwFormData.logging,
        }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchData();
        setCreateModal(false);
        resetFwForm();
      } else {
        alert(json.error || 'Failed to create rule');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create rule');
    }
  };

  const handleDeleteFirewallRule = async (id: string) => {
    if (!confirm('Xóa rule này?')) return;
    
    try {
      const res = await networkFetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'firewall', action: 'delete', id }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchData();
      } else {
        alert(json.error || 'Failed to delete rule');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const resetFwForm = () => {
    setFwFormData({
      name: '',
      action: 'accept',
      ruleset: 'WAN',
      src_ip: 'any',
      src_port: '',
      dst_ip: 'any',
      dst_port: '',
      protocols: ['tcp'],
      logging: false,
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'accept': return 'text-green-600 bg-green-50';
      case 'drop': return 'text-red-600 bg-red-50';
      case 'reject': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  if (loading && firewallRules.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải firewall...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firewall</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý rules & port forwards</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
          {activeTab === 'rules' && (
            <button
              onClick={() => setCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Tạo Rule
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Firewall Rules ({firewallRules.length})
        </button>
        <button
          onClick={() => setActiveTab('portforwards')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'portforwards'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Port Forwards ({portForwards.length})
        </button>
      </div>

      {activeTab === 'rules' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{firewallRules.length}</p>
              <p className="text-xs text-slate-500">Tổng Rules</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{firewallRules.filter(r => r.enabled).length}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{firewallRules.filter(r => r.logging).length}</p>
              <p className="text-xs text-slate-500">With Logging</p>
            </div>
          </div>

          {/* Rules List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Destination</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Protocol</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {firewallRules.map((rule) => (
                  <tr key={rule._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">{rule.name}</span>
                      {rule.logging && (
                        <Lock className="w-4 h-4 text-slate-400 ml-2 inline" />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(rule.action)}`}>
                        {rule.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 font-mono">
                        {rule.src_ip || rule.src_cidr || 'any'}
                      </span>
                      {rule.src_port && (
                        <span className="text-xs text-slate-400 ml-1">:{rule.src_port}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 font-mono">
                        {rule.dst_ip || rule.dst_cidr || 'any'}
                      </span>
                      {rule.dst_port && (
                        <span className="text-xs text-slate-400 ml-1">:{rule.dst_port}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 uppercase">
                        {rule.protocols?.join(', ') || 'TCP/UDP'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        rule.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleDeleteFirewallRule(rule._id)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {firewallRules.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Không có firewall rule nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Port Forwards List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Protocol</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Destination</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portForwards.map((pf) => (
                  <tr key={pf._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">{pf.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded uppercase">
                        {pf.protocol}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 font-mono">
                        {pf.src_ip || 'any'}:{pf.src_port}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600 font-mono">
                          {pf.dst_ip}:{pf.dst_port}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        pf.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {pf.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
                {portForwards.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Không có port forward nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Rule Modal */}
      <AnimatePresence>
        {createModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Tạo Firewall Rule</h3>
                <button onClick={() => setCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={fwFormData.name}
                    onChange={(e) => setFwFormData({ ...fwFormData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My Firewall Rule"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                    <select
                      value={fwFormData.action}
                      onChange={(e) => setFwFormData({ ...fwFormData, action: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="accept">Accept</option>
                      <option value="drop">Drop</option>
                      <option value="reject">Reject</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ruleset</label>
                    <select
                      value={fwFormData.ruleset}
                      onChange={(e) => setFwFormData({ ...fwFormData, ruleset: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="WAN">WAN</option>
                      <option value="LAN">LAN</option>
                      <option value="GUEST">GUEST</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source IP</label>
                    <input
                      type="text"
                      value={fwFormData.src_ip}
                      onChange={(e) => setFwFormData({ ...fwFormData, src_ip: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="any hoặc IP/CIDR"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source Port</label>
                    <input
                      type="text"
                      value={fwFormData.src_port}
                      onChange={(e) => setFwFormData({ ...fwFormData, src_port: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 1024:65535"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Destination IP</label>
                    <input
                      type="text"
                      value={fwFormData.dst_ip}
                      onChange={(e) => setFwFormData({ ...fwFormData, dst_ip: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="any hoặc IP/CIDR"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Destination Port</label>
                    <input
                      type="text"
                      value={fwFormData.dst_port}
                      onChange={(e) => setFwFormData({ ...fwFormData, dst_port: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 80, 443"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Protocols</label>
                  <div className="flex gap-4">
                    {['tcp', 'udp', 'tcp_udp'].map((proto) => (
                      <label key={proto} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fwFormData.protocols.includes(proto)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFwFormData({ ...fwFormData, protocols: [...fwFormData.protocols, proto] });
                            } else {
                              setFwFormData({ ...fwFormData, protocols: fwFormData.protocols.filter(p => p !== proto) });
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-slate-700 uppercase">{proto}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fwFormData.logging}
                    onChange={(e) => setFwFormData({ ...fwFormData, logging: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Enable Logging</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateFirewallRule}
                  disabled={!fwFormData.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Tạo Rule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
