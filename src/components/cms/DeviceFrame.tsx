'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DeviceVariant, Viewport } from '@/lib/template-document';

export interface DeviceFrameHandle {
  /** Returns the bounding rect of the screen area in viewport (client) coordinates */
  getScreenRect: () => DOMRect | null;
  getIframeRect: () => DOMRect | null;
  getIframeWindow: () => Window | null;
  getIframeDocument: () => Document | null;
}

export interface DeviceFrameProps {
  device: DeviceVariant;
  viewport: Viewport;
  zoom: number;
  children: ReactNode;
  overlay?: ReactNode;
  onWindow?: (win: Window) => void;
  onNodeClick?: (nodeId: string, sectionId: string) => void;
  title?: string;
  showStand?: boolean;
}

const DeviceFrame = forwardRef<DeviceFrameHandle, DeviceFrameProps>(function DeviceFrame(
  {
    device,
    viewport,
    zoom,
    children,
    overlay,
    onWindow,
    onNodeClick,
    title = 'Bản xem trước thiết bị',
    showStand = false,
  },
  ref
) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const callback = useRef(onWindow);
  callback.current = onWindow;
  const nodeClickRef = useRef(onNodeClick);
  nodeClickRef.current = onNodeClick;

  useImperativeHandle(ref, () => ({
    getScreenRect: () => screenRef.current?.getBoundingClientRect() ?? null,
    getIframeRect: () => iframe.current?.getBoundingClientRect() ?? null,
    getIframeWindow: () => iframe.current?.contentWindow ?? null,
    getIframeDocument: () => iframe.current?.contentDocument ?? null,
  }));

  useEffect(() => {
    const frame = iframe.current;
    if (!frame) return;
    let observer: MutationObserver | undefined;

    const setup = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;

      const sync = () => {
        let baseEl = doc.head.querySelector('base');
        if (!baseEl) {
          baseEl = doc.createElement('base');
          baseEl.href = window.location.origin + '/';
          doc.head.insertBefore(baseEl, doc.head.firstChild);
        }

        doc.head.querySelectorAll('[data-frame-style]').forEach((el) => el.remove());
        document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          copy.setAttribute('data-frame-style', '');
          doc.head.appendChild(copy);
        });
        doc.documentElement.className = document.documentElement.className;
        doc.body.className = document.body.className;
        doc.body.style.cssText = `margin:0;min-height:100%;background-color:transparent;font-family:${getComputedStyle(document.body).fontFamily};overflow-x:hidden;`;

        const scrollStyle = doc.createElement('style');
        scrollStyle.setAttribute('data-frame-scrollbar', '');
        scrollStyle.textContent = `
          html, body {
            overscroll-behavior: contain;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
          }
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4);
            border-radius: 999px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 0.65);
          }
        `;
        doc.head.appendChild(scrollStyle);
      };

      sync();
      observer?.disconnect();
      observer = new MutationObserver(sync);
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      setBody(doc.body);
      callback.current?.(win);

      const checkOverflow = () => {
        if (doc.documentElement) {
          setHasOverflow(doc.documentElement.scrollHeight > viewport.height + 24);
        }
      };
      const onScroll = () => {
        setScrollY(win.scrollY || 0);
        checkOverflow();
      };
      win.addEventListener('scroll', onScroll, { passive: true });
      checkOverflow();

      return () => {
        win.removeEventListener('scroll', onScroll);
      };
    };

    const cleanupSetup = setup();
    frame.addEventListener('load', setup);
    return () => {
      cleanupSetup?.();
      observer?.disconnect();
      frame.removeEventListener('load', setup);
    };
  }, []);

  // Frame dimension settings
  const framePadding = device === 'mobile' ? 12 : device === 'tablet' ? 16 : 10;
  const headerHeight = device === 'desktop' ? 38 : 0;
  const frameWidth = viewport.width + framePadding * 2;
  const frameHeight = viewport.height + framePadding * 2 + headerHeight;
  const borderRadius = device === 'mobile' ? 48 : device === 'tablet' ? 26 : 14;
  const innerRadius = device === 'mobile' ? 38 : device === 'tablet' ? 16 : 6;

  // Aspect ratio description helper
  const getAspectRatioLabel = () => {
    const r = (viewport.width / viewport.height).toFixed(2);
    if (r === '0.46' || r === '0.45') return '19.5:9 (Phone)';
    if (r === '0.56') return '16:9 (Mobile)';
    if (r === '0.75') return '3:4 (iPad)';
    if (r === '1.33') return '4:3 (iPad ngang)';
    if (r === '1.60') return '16:10 (MacBook)';
    if (r === '1.78') return '16:9 (Full HD)';
    return `${viewport.width}×${viewport.height}`;
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none transition-transform duration-75"
      style={{
        width: frameWidth * zoom,
        height: frameHeight * zoom,
        flexShrink: 0,
      }}
    >
      <div
        className="relative shadow-2xl transition-all duration-150"
        style={{
          width: frameWidth,
          height: frameHeight,
          padding: `${framePadding + headerHeight}px ${framePadding}px ${framePadding}px`,
          backgroundColor: device === 'desktop' ? '#1e293b' : '#0f172a',
          borderRadius,
          border: device === 'desktop' ? '2px solid #334155' : '2px solid #1e293b',
          boxShadow:
            device === 'mobile'
              ? '0 30px 70px -15px rgba(0, 0, 0, 0.4), inset 0 0 0 2px rgba(255,255,255,0.08)'
              : device === 'tablet'
              ? '0 35px 80px -15px rgba(0, 0, 0, 0.35), inset 0 0 0 2px rgba(255,255,255,0.06)'
              : '0 35px 80px -15px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255,255,255,0.1)',
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Desktop Browser Header — Sleek macOS Style */}
        {device === 'desktop' && (
          <div
            className="absolute top-0 left-0 right-0 h-[38px] px-3.5 flex items-center justify-between border-b border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900"
            style={{ borderTopLeftRadius: borderRadius - 2, borderTopRightRadius: borderRadius - 2 }}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm inline-block border border-rose-600" />
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm inline-block border border-amber-600" />
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm inline-block border border-emerald-600" />
            </div>
            <div className="flex-1 max-w-sm mx-auto px-3.5 py-1 bg-slate-950/70 rounded-lg border border-slate-700/60 flex items-center justify-center gap-1.5 text-[11px] text-slate-300 font-mono tracking-tight shadow-inner">
              <span className="text-emerald-400 text-xs">🔒</span>
              <span className="text-slate-400">https://</span>
              <span className="text-white font-medium">wifi.marketing.local</span>
              <span className="text-slate-400">/hotspot</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{getAspectRatioLabel()}</span>
            </div>
          </div>
        )}

        {/* Mobile Dynamic Island (Apple iPhone 15/16 Pro Standard) */}
        {device === 'mobile' && (
          <div
            className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center justify-between bg-black rounded-full px-3 shadow-lg border border-neutral-800"
            style={{ width: 112, height: 26 }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-blue-950/60" />
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-950 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-neutral-800" />
            </div>
          </div>
        )}

        {/* Tablet Front Camera Dot (iPad Pro Standard) */}
        {device === 'tablet' && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700 pointer-events-none z-30 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-blue-900/40" />
          </div>
        )}

        {/* Screen Container */}
        <div
          ref={screenRef}
          className="relative w-full h-full overflow-hidden bg-white shadow-inner"
          style={{ borderRadius: innerRadius }}
        >
          <iframe
            ref={iframe}
            title={title}
            style={{
              display: 'block',
              border: 0,
              width: viewport.width,
              height: viewport.height,
              backgroundColor: '#ffffff',
              pointerEvents: 'auto',
            }}
          />
          {body && createPortal(children, body)}
          {overlay}

          {/* Mép màn hình (Fold line indicator) when content is long */}
          {hasOverflow && scrollY < 20 && (
            <div
              className="absolute left-0 right-0 pointer-events-none z-30 transition-opacity"
              style={{
                top: viewport.height,
                borderTop: '1px dashed #3b82f6',
              }}
            >
              <span className="absolute right-2 -top-5 px-1.5 py-0.5 rounded bg-blue-600/90 text-white text-[9px] font-mono shadow-sm">
                Mép màn hình (khách thấy ngay)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default DeviceFrame;
