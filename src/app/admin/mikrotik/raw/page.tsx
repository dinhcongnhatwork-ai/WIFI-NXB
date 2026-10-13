'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RefreshCw } from 'lucide-react';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export default function MikrotikRawApiPage() {
  const [path, setPath] = useState('/ip/hotspot/user');
  const [method, setMethod] = useState<Method>('GET');
  const [payload, setPayload] = useState('{\n  \n}');
  const [running, setRunning] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canUsePayload = useMemo(() => method !== 'GET' && method !== 'DELETE', [method]);

  const executeRequest = async () => {
    try {
      setRunning(true);
      setError(null);

      if (!path.trim()) {
        throw new Error('Vui lòng nhập path');
      }

      if (method === 'GET') {
        const res = await fetch(`/api/mikrotik/raw?path=${encodeURIComponent(path.trim())}`);
        const json = await res.json();
        setResponseText(JSON.stringify(json, null, 2));
        if (!json.success) {
          throw new Error(json.error || 'Raw API call failed');
        }
        return;
      }

      let parsedPayload: unknown = undefined;
      if (payload.trim().length > 0) {
        try {
          parsedPayload = JSON.parse(payload);
        } catch {
          throw new Error('Payload JSON không hợp lệ');
        }
      }

      const res = await fetch('/api/mikrotik/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path.trim(),
          method,
          payload: parsedPayload,
        }),
      });

      const json = await res.json();
      setResponseText(JSON.stringify(json, null, 2));
      if (!json.success) {
        throw new Error(json.error || 'Raw API call failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raw API call failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">MikroTik Raw API Explorer</h1>
        <p className="text-slate-500 text-sm mt-1">Call full RouterOS REST API trực tiếp</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as Method)}
            className="px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>

          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/ip/hotspot/user"
            className="md:col-span-3 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {canUsePayload && (
          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
            placeholder="JSON payload"
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void executeRequest()}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Execute
          </button>

          <button
            onClick={() => {
              setResponseText('');
              setError(null);
            }}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        {error && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-700 mb-1">Ví dụ path nhanh:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <code>/system/resource</code>
            <code>/interface</code>
            <code>/ip/address</code>
            <code>/ip/route</code>
            <code>/ip/firewall/filter</code>
            <code>/ip/hotspot/user</code>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Response</h2>
        </div>
        <pre className="p-5 text-xs text-slate-700 overflow-auto max-h-[600px] bg-slate-950 text-slate-100">
{responseText || '// Chưa có response'}
        </pre>
      </div>
    </motion.div>
  );
}
