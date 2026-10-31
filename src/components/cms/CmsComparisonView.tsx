'use client';

import React from 'react';
import DeviceFrame from './DeviceFrame';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import {
  type TemplateDocumentV2,
  DEVICES,
  type DeviceVariant,
  type ScreenId,
} from '@/lib/template-document';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

interface CmsComparisonViewProps {
  document: TemplateDocumentV2;
  activeDevice: DeviceVariant;
  screen: ScreenId;
  onSelectDevice: (device: DeviceVariant) => void;
}

export default function CmsComparisonView({
  document,
  activeDevice,
  screen,
  onSelectDevice,
}: CmsComparisonViewProps) {
  const configs: {
    device: DeviceVariant;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    zoom: number;
  }[] = [
    { device: 'mobile', label: 'Mobile (390×844)', icon: Smartphone, zoom: 0.55 },
    { device: 'tablet', label: 'Tablet (768×1024)', icon: Tablet, zoom: 0.42 },
    { device: 'desktop', label: 'PC (1440×900)', icon: Monitor, zoom: 0.3 },
  ];

  return (
    <div
      className="w-full h-full overflow-auto bg-slate-100 p-8 flex flex-col xl:flex-row items-center justify-around gap-8"
      style={{
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {configs.map(({ device, label, icon: Icon, zoom }) => {
        const viewport = DEVICES[device].presets[0];
        const isActive = device === activeDevice;

        return (
          <div
            key={device}
            onClick={() => onSelectDevice(device)}
            className={`flex flex-col items-center p-4 rounded-2xl border transition-all cursor-pointer ${
              isActive
                ? 'bg-white border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                : 'bg-white/90 border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
          >
            {/* Header tag */}
            <div className="flex items-center gap-2 mb-3 select-none">
              <div
                className={`p-1.5 rounded-lg ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-xs font-semibold ${
                  isActive ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                  Đang chọn
                </span>
              )}
            </div>

            {/* Device frame preview */}
            <div className="pointer-events-none">
              <DeviceFrame
                device={device}
                viewport={viewport}
                zoom={zoom}
                title={`So sánh ${label}`}
              >
                <DocumentRenderer
                  document={document}
                  variant={device}
                  viewport={viewport}
                  mode="edit"
                  screen={screen}
                />
              </DeviceFrame>
            </div>
          </div>
        );
      })}
    </div>
  );
}
