'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Globe,
  Wifi,
  Shield,
  Server,
  CheckCircle,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  MoreVertical,
  Zap,
} from 'lucide-react';

interface UnifiNetwork {
  _id: string;
  name: string;
  purpose: string;
  vlanId?: number;
  vlanEnabled?: boolean;
  ipSubnet?: string;
  ipSubnetGw?: string;
  dhcpdEnabled?: boolean;
  dhcpdStart?: string;
  dhcpdStop?: string;
  dhcpdLease?: number;
  domainName?: string;
  enabled: boolean;
  isNat?: boolean;
  numStations?: number;
}

interface UserGroup {
  _id: string;
  name: string;
  bandwidthPolicyDown?: number;
  bandwidthPolicyUp?: number;
}

interface TopologyNode {
  id: string;
  type: 'gateway' | 'switch' | 'ap' | 'network' | 'client';
  name: string;
  status?: string;
  mac?: string;
  ip?: string;
}

interface TopologyLink {
  source: string;
  target: string;
  type: 'uplink' | 'wired' | 'wireless' | 'network';
}

interface TopologyData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  summary: {
    gateways: number;
    switches: number;
    accessPoints: number;
    networks: number;
    clients: number;
  };
}

export default function UnifiNetworksPage() {
  const [networks, setNetworks] = useState<UnifiNetwork[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'networks' | 'usergroups'>('networks');
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; network: UnifiNetwork | null }>({ open: false, network: null });

  const [formData, setFormData] = useState({
    name: '',
    purpose: 'corporate',
    vlanEnabled: false,
    vlanId: '',
    ipSubnet: '',
    ipSubnetGw: '',
    dhcpdEnabled: true,
    dhcpdStart: '',
    dhcpdStop: '',
    dhcpdLease: 86400,
    domainName: '',
    enabled: true,
    isNat: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [networksRes, groupsRes, topologyRes] = await Promise.all([
        fetch('/api/unifi/settings?type=networks'),
        fetch('/api/unifi/settings?type=usergroups'),
        fetch('/api/unifi/settings?type=topology'),
      ]);

      const [networksJson, groupsJson, topologyJson] = await Promise.all([
        networksRes.json(),
        groupsRes.json(),
        topologyRes.json(),
      ]);

      if (networksJson.success) {
        setNetworks(networksJson.data);
      }
      if (groupsJson.success) {
        setUserGroups(groupsJson.data);
      }
      if (topologyJson.success) {
        setTopology(topologyJson.data);
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

  const handleCreateNetwork = async () => {
    try {
      const payload = {
        type: 'network',
        action: 'create',
        name: formData.name,
        purpose: formData.purpose,
        vlanEnabled: formData.vlanEnabled,
        vlanId: formData.vlanEnabled ? parseInt(formData.vlanId) : undefined,
        ipSubnet: formData.ipSubnet,
        ipSubnetGw: formData.ipSubnetGw,
        dhcpdEnabled: formData.dhcpdEnabled,
        dhcpdStart: formData.dhcpdStart,
        dhcpdStop: formData.dhcpdStop,
        dhcpdLease: formData.dhcpdLease,
        domainName: formData.domainName,
        enabled: formData.enabled,
        isNat: formData.isNat,
      };

      const res = await fetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        await fetchData();
        setCreateModal(false);
        resetForm();
      } else {
        alert(json.error || 'Failed to create network');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create network');
    }
  };

  const handleDeleteNetwork = async (id: string) => {
    if (!confirm('Xóa network này?')) return;
    
    try {
      const res = await fetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'network', action: 'delete', id }),
      });
      const json = await res.json();

      if (json.success) {
        await fetchData();
      } else {
        alert(json.error || 'Failed to delete network');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete network');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      purpose: 'corporate',
      vlanEnabled: false,
      vlanId: '',
      ipSubnet: '',
      ipSubnetGw: '',
      dhcpdEnabled: true,
      dhcpdStart: '',
      dhcpdStop: '',
      dhcpdLease: 86400,
      domainName: '',
      enabled: true,
      isNat: true,
    });
  };

  const openEditModal = (network: UnifiNetwork) => {
    setFormData({
      name: network.name,
      purpose: network.purpose,
      vlanEnabled: network.vlanEnabled || false,
      vlanId: network.vlanId?.toString() || '',
      ipSubnet: network.ipSubnet || '',
      ipSubnetGw: network.ipSubnetGw || '',
      dhcpdEnabled: network.dhcpdEnabled ?? true,
      dhcpdStart: network.dhcpdStart || '',
      dhcpdStop: network.dhcpdStop || '',
      dhcpdLease: network.dhcpdLease || 86400,
      domainName: network.domainName || '',
      enabled: network.enabled,
      isNat: network.isNat ?? true,
    });
    setEditModal({ open: true, network });
  };

  const handleUpdateNetwork = async () => {
    if (!editModal.network) return;

    try {
      const payload = {
        type: 'network',
        action: 'update',
        id: editModal.network._id,
        name: formData.name,
        purpose: formData.purpose,
        vlanEnabled: formData.vlanEnabled,
        vlanId: formData.vlanEnabled ? parseInt(formData.vlanId) : undefined,
        ipSubnet: formData.ipSubnet,
        ipSubnetGw: formData.ipSubnetGw,
        dhcpdEnabled: formData.dhcpdEnabled,
        dhcpdStart: formData.dhcpdStart,
        dhcpdStop: formData.dhcpdStop,
        dhcpdLease: formData.dhcpdLease,
        domainName: formData.domainName,
        enabled: formData.enabled,
        isNat: formData.isNat,
      };

      const res = await fetch('/api/unifi/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        await fetchData();
        setEditModal({ open: false, network: null });
        resetForm();
      } else {
        alert(json.error || 'Failed to update network');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update network');
    }
  };

  const getPurposeLabel = (purpose: string) => {
    const labels: Record<string, string> = {
      corporate: 'Corporate',
      guest: 'Guest',
      wan: 'WAN',
      lan: 'LAN',
    };
    return labels[purpose] || purpose;
  };

  const getPurposeIcon = (purpose: string) => {
    const icons: Record<string, React.ReactNode> = {
      corporate: <Server className="w-5 h-5" />,
      guest: <Wifi className="w-5 h-5" />,
      wan: <Globe className="w-5 h-5" />,
      lan: <Network className="w-5 h-5" />,
    };
    return icons[purpose] || <Network className="w-5 h-5" />;
  };

  if (loading && networks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Đang tải mạng...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mạng</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý networks & VLANs</p>
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
          {activeTab === 'networks' && (
            <button
              onClick={() => setCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Tạo Network
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('networks')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'networks'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Networks
        </button>
        <button
          onClick={() => setActiveTab('usergroups')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'usergroups'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          User Groups
        </button>
      </div>

      {activeTab === 'networks' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{networks.length}</p>
              <p className="text-xs text-slate-500">Tổng Networks</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{networks.filter(n => n.enabled).length}</p>
              <p className="text-xs text-slate-500">Active</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{networks.filter(n => n.vlanEnabled).length}</p>
              <p className="text-xs text-slate-500">VLAN</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">
                {networks.reduce((sum, n) => sum + (n.numStations || 0), 0)}
              </p>
              <p className="text-xs text-slate-500">Connected Devices</p>
            </div>
          </div>

          {/* Topology */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Network Topology</h2>
                <p className="text-sm text-slate-500">Sơ đồ kết nối lấy trực tiếp từ UniFi Controller</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                {topology?.nodes.length || 0} nodes
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                <p className="text-xs text-purple-700">Gateway</p>
                <p className="text-xl font-semibold text-purple-900">{topology?.summary.gateways || 0}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Switch</p>
                <p className="text-xl font-semibold text-blue-900">{topology?.summary.switches || 0}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Access Point</p>
                <p className="text-xl font-semibold text-emerald-900">{topology?.summary.accessPoints || 0}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Networks</p>
                <p className="text-xl font-semibold text-amber-900">{topology?.summary.networks || 0}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-700">Clients</p>
                <p className="text-xl font-semibold text-slate-900">{topology?.summary.clients || 0}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-700">
                Liên kết chính
              </div>
              <div className="max-h-72 overflow-auto divide-y divide-slate-100">
                {topology && topology.links.length > 0 ? (
                  topology.links.slice(0, 200).map((link, idx) => {
                    const source = topology.nodes.find((node) => node.id === link.source);
                    const target = topology.nodes.find((node) => node.id === link.target);
                    return (
                      <div key={`${link.source}-${link.target}-${idx}`} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{source?.name || link.source}</p>
                          <p className="text-xs text-slate-500 truncate">{source?.type || 'node'} -&gt; {target?.type || 'node'}</p>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{link.type}</span>
                          <p className="text-sm text-slate-700 truncate max-w-[220px]">{target?.name || link.target}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Chưa lấy được dữ liệu topology
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Networks List */}
          <div className="space-y-4">
            {networks.map((network) => (
              <motion.div
                key={network._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl border overflow-hidden ${
                  network.enabled ? 'border-slate-200' : 'border-slate-300 opacity-75'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        network.enabled ? 'bg-blue-100' : 'bg-slate-100'
                      }`}>
                        <div className={network.enabled ? 'text-blue-600' : 'text-slate-400'}>
                          {getPurposeIcon(network.purpose)}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-slate-900">{network.name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            network.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {network.enabled ? 'Active' : 'Disabled'}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                            {getPurposeLabel(network.purpose)}
                          </span>
                          {network.vlanEnabled && network.vlanId && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              VLAN {network.vlanId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          {network.ipSubnet && (
                            <span className="font-mono">{network.ipSubnet}</span>
                          )}
                          {network.dhcpdEnabled && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-4 h-4" />
                              DHCP: {network.dhcpdStart} - {network.dhcpdStop}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditModal(network)}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNetwork(network._id)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {networks.length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Network className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Không có network nào</h3>
              <p className="text-slate-500 mb-4">Tạo network mới để bắt đầu</p>
              <button
                onClick={() => setCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Tạo Network
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* User Groups */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Download</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Upload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userGroups.map((group) => (
                  <tr key={group._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-900">{group.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      {group.bandwidthPolicyDown ? (
                        <span className="text-slate-700">{group.bandwidthPolicyDown} Kbps</span>
                      ) : (
                        <span className="text-slate-400">Unlimited</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {group.bandwidthPolicyUp ? (
                        <span className="text-slate-700">{group.bandwidthPolicyUp} Kbps</span>
                      ) : (
                        <span className="text-slate-400">Unlimited</span>
                      )}
                    </td>
                  </tr>
                ))}
                {userGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                      Không có user group nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Modal */}
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
                <h3 className="text-lg font-semibold text-slate-900">Tạo Network mới</h3>
                <button onClick={() => setCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên Network *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Network Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="corporate">Corporate</option>
                    <option value="guest">Guest</option>
                    <option value="wan">WAN</option>
                    <option value="lan">LAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subnet (CIDR)</label>
                  <input
                    type="text"
                    value={formData.ipSubnet}
                    onChange={(e) => setFormData({ ...formData, ipSubnet: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="192.168.1.0/24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gateway</label>
                  <input
                    type="text"
                    value={formData.ipSubnetGw}
                    onChange={(e) => setFormData({ ...formData, ipSubnetGw: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="192.168.1.1"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.vlanEnabled}
                    onChange={(e) => setFormData({ ...formData, vlanEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Enable VLAN</span>
                </label>

                {formData.vlanEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VLAN ID</label>
                    <input
                      type="number"
                      value={formData.vlanId}
                      onChange={(e) => setFormData({ ...formData, vlanId: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1-4094"
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.dhcpdEnabled}
                    onChange={(e) => setFormData({ ...formData, dhcpdEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Enable DHCP</span>
                </label>

                {formData.dhcpdEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">DHCP Start</label>
                      <input
                        type="text"
                        value={formData.dhcpdStart}
                        onChange={(e) => setFormData({ ...formData, dhcpdStart: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">DHCP End</label>
                      <input
                        type="text"
                        value={formData.dhcpdStop}
                        onChange={(e) => setFormData({ ...formData, dhcpdStop: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="192.168.1.200"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateNetwork}
                  disabled={!formData.name}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Tạo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditModal({ open: false, network: null })}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Chỉnh sửa Network</h3>
                <button onClick={() => setEditModal({ open: false, network: null })} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tên Network *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="corporate">Corporate</option>
                    <option value="guest">Guest</option>
                    <option value="wan">WAN</option>
                    <option value="lan">LAN</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subnet</label>
                    <input
                      type="text"
                      value={formData.ipSubnet}
                      onChange={(e) => setFormData({ ...formData, ipSubnet: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gateway</label>
                    <input
                      type="text"
                      value={formData.ipSubnetGw}
                      onChange={(e) => setFormData({ ...formData, ipSubnetGw: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.vlanEnabled}
                    onChange={(e) => setFormData({ ...formData, vlanEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Enable VLAN</span>
                </label>

                {formData.vlanEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VLAN ID</label>
                    <input
                      type="number"
                      value={formData.vlanId}
                      onChange={(e) => setFormData({ ...formData, vlanId: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.dhcpdEnabled}
                    onChange={(e) => setFormData({ ...formData, dhcpdEnabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Enable DHCP</span>
                </label>

                {formData.dhcpdEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">DHCP Start</label>
                      <input
                        type="text"
                        value={formData.dhcpdStart}
                        onChange={(e) => setFormData({ ...formData, dhcpdStart: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">DHCP End</label>
                      <input
                        type="text"
                        value={formData.dhcpdStop}
                        onChange={(e) => setFormData({ ...formData, dhcpdStop: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => setEditModal({ open: false, network: null })}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateNetwork}
                  disabled={!formData.name}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Lưu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}