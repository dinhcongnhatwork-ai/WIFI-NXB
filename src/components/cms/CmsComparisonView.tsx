'use client';

import React from 'react';
import DeviceFrame from './DeviceFrame';
import DocumentRenderer from '@/components/renderer/DocumentRenderer';
import {
  type TemplateDocumentV2,
  DEVICES,
  type DeviceVariant,
} from '@/lib/template-document';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

interface CmsComparisonViewProps {
  document: TemplateDocumentV2;
  activeDevice: DeviceVariant;
  onSelectDevice: (device: DeviceVariant) => void;
}

export default function CmsComparisonView({
  document,
  activeDevice,
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
    <div className="w-full h-full overflow-auto bg-[#070b14] p-8 flex flex-col xl:flex-row items-center justify-around gap-8">
      {configs.map(({ device, label, icon: Icon, zoom }) => {
        const viewport = DEVICES[device].presets[0];
        const isActive = device === activeDevice;

        return (
          <div
            key={device}
            onClick={() => onSelectDevice(device)}
            className={`flex flex-col items-center p-4 rounded-2xl border transition-all cursor-pointer ${
              isActive
                ? 'bg-white/90 border-blue-400 shadow-xl shadow-blue-200 ring-1 ring-blue-300'
                : 'bg-gray-50 border-gray-200/80 hover:border-gray-300'
            }`}
          >
            {/* Header tag */}
            <div className="flex items-center gap-2 mb-3 select-none">
              <div
                className={`p-1.5 rounded-lg ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-xs font-semibold ${
                  isActive ? 'text-white' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
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
                  mode="simulate"
                />
              </DeviceFrame>
            </div>
          </div>
        );
      })}
    </div>
  );
}
