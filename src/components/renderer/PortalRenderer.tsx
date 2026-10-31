'use client';

import React, { useState, useEffect, useRef } from 'react';
import DocumentRenderer from './DocumentRenderer';
import { toDocument } from '@/lib/template-document';
import type { AttendanceContext } from './flow-runtime';
import type {
  TemplateConfig,
  TemplateElement,
  LogoElement,
  TitleElement,
  DescriptionElement,
  ImageElement,
  ImageSliderElement,
  VideoElement,
  ConnectButtonElement,
  VideoGateElement,
  AnnouncementElement,
  AttendanceGateElement,
  SpacerElement,
  PortalParams,
} from '@/types';

interface Props {
  config: TemplateConfig;
  params: Partial<PortalParams>;
  isPreview?: boolean;
  redirectUrl?: string;
  campaignId?: string;
  previewMode?: 'mobile' | 'tablet' | 'desktop';
  attendanceContext?: AttendanceContext;
  portalSessionId?: string;
}

export default function PortalRenderer({ config, params, isPreview, redirectUrl, campaignId, previewMode, attendanceContext, portalSessionId }: Props) {
  return <DocumentRenderer document={toDocument(config)} params={params} mode={isPreview?'simulate':'live'} variant={previewMode} redirectUrl={redirectUrl} campaignId={campaignId} attendanceContext={attendanceContext} portalSessionId={portalSessionId} />;
}

export function RenderElement({
  element,
  params,
  isPreview,
  redirectUrl,
  campaignId,
  isDesktop,
  autoPlayTrigger,
  onSimulateConnect,
  onConnectionStart,
  portalSessionId,
}: {
  element: TemplateElement;
  params: Partial<PortalParams>;
  isPreview?: boolean;
  redirectUrl?: string;
  campaignId?: string;
  isDesktop?: boolean;
  autoPlayTrigger?: number;
  onSimulateConnect?: () => void;
  onConnectionStart?: () => void;
  portalSessionId?: string;
}) {
  switch (element.type) {
    case 'logo': return <LogoRenderer el={element} isPreview={isPreview} />;
    case 'title': return <TitleRenderer el={element} />;
    case 'description': return <DescriptionRenderer el={element} />;
    case 'image': return <ImageRenderer el={element} isDesktop={isDesktop} />;
    case 'image_slider': return <ImageSliderRenderer el={element} isDesktop={isDesktop} />;
    case 'video': return <VideoRenderer el={element} isDesktop={isDesktop} autoPlayTrigger={autoPlayTrigger} />;
    case 'connect_button': return <ConnectButtonRenderer el={element} params={params} isPreview={isPreview} redirectUrl={redirectUrl} campaignId={campaignId} isDesktop={isDesktop} onSimulateConnect={onSimulateConnect} onConnectionStart={onConnectionStart} portalSessionId={portalSessionId} />;
    case 'spacer': return <SpacerRenderer el={element} isDesktop={isDesktop} />;
    case 'video_gate': return <VideoGateMockupRenderer el={element as VideoGateElement} isDesktop={isDesktop} />;
    case 'attendance_gate': return <AttendanceGateMockupRenderer el={element as AttendanceGateElement} isDesktop={isDesktop} />;
    case 'announcement': return <AnnouncementMockupRenderer el={element as AnnouncementElement} isDesktop={isDesktop} />;
    default: return null;
  }
}

export function resolveShadowStyle(shadow?: string, glowColor = 'rgba(59,130,246,0.38)'): string {
  if (!shadow || shadow === 'none') return 'none';
  if (shadow === 'sm' || shadow === 'soft') return '0 2px 8px rgba(0,0,0,0.12)';
  if (shadow === 'md' || shadow === 'medium') return '0 8px 20px -4px rgba(0,0,0,0.22)';
  if (shadow === 'lg' || shadow === 'strong') return '0 16px 36px -6px rgba(0,0,0,0.32)';
  if (shadow === 'xl') return '0 24px 48px -8px rgba(0,0,0,0.42)';
  if (shadow === 'glow') return `0 10px 30px -4px ${glowColor}`;
  return 'none';
}

export function resolveBorderStyle(
  borderStyle?: string,
  borderWidth?: string | number,
  borderColor?: string
): string {
  if (!borderStyle || borderStyle === 'none') return 'none';
  if (borderStyle === 'glass') return '1px solid rgba(255,255,255,0.38)';
  const widthCss =
    typeof borderWidth === 'number'
      ? `${borderWidth}px`
      : borderWidth
      ? /^\d+(\.\d+)?$/.test(String(borderWidth).trim())
        ? `${String(borderWidth).trim()}px`
        : String(borderWidth)
      : '2px';
  return `${widthCss} ${borderStyle} ${borderColor || '#ffffff'}`;
}

export function resolveTextShadow(textShadow?: string): string | undefined {
  if (!textShadow || textShadow === 'none') return undefined;
  if (textShadow === 'sm') return '0 1px 3px rgba(0,0,0,0.45)';
  if (textShadow === 'md') return '0 2px 8px rgba(0,0,0,0.65)';
  if (textShadow === 'lg') return '0 4px 16px rgba(0,0,0,0.85)';
  if (textShadow === 'glow') return '0 0 18px rgba(59,130,246,0.8), 0 2px 6px rgba(0,0,0,0.5)';
  return textShadow;
}

export function applyColorOpacity(color?: string, opacity?: number): string | undefined {
  if (!color || color === 'transparent') return undefined;
  if (opacity === undefined || opacity >= 1) return color;
  const clean = color.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean)) {
    const hex = clean.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
  }
  return color;
}

export function buildMediaFilterCss(opts: {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  blur?: number;
}): string | undefined {
  const parts: string[] = [];
  if (opts.blur && opts.blur > 0) parts.push(`blur(${opts.blur}px)`);
  if (opts.brightness !== undefined && opts.brightness !== 100) parts.push(`brightness(${opts.brightness}%)`);
  if (opts.contrast !== undefined && opts.contrast !== 100) parts.push(`contrast(${opts.contrast}%)`);
  if (opts.saturate !== undefined && opts.saturate !== 100) parts.push(`saturate(${opts.saturate}%)`);
  if (opts.grayscale && opts.grayscale > 0) parts.push(`grayscale(${opts.grayscale}%)`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function LogoRenderer({ el, isPreview }: { el: LogoElement; isPreview?: boolean }) {
  const justify = el.position === 'left' ? 'flex-start' : el.position === 'right' ? 'flex-end' : 'center';
  if (!el.src) {
    if (!isPreview) return null;
    return (
      <div style={{ display: 'flex', justifyContent: justify, padding: '8px 0', width: '100%', minHeight: el.height || '64px' }}>
        <div
          style={{
            width: el.width || '140px',
            minHeight: el.height || '64px',
            border: '2px dashed #94a3b8',
            borderRadius: el.borderRadius || '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.22)',
            color: '#334155',
            fontSize: '12px',
            gap: '2px',
            backdropFilter: 'blur(4px)',
            padding: '8px 12px',
            boxSizing: 'border-box',
          }}
        >
          <span className="font-semibold text-slate-800">🏷️ Logo</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }} className="text-slate-600">Bấm để tải ảnh</span>
        </div>
      </div>
    );
  }
  const hasPlate = Boolean((el.bgColor && el.bgColor !== 'transparent') || el.padding || (el.shadow && el.shadow !== 'none') || el.borderColor);
  const plateBg = applyColorOpacity(el.bgColor, el.bgOpacity);
  const padVal = typeof el.padding === 'number' ? `${el.padding}px` : el.padding || (hasPlate ? '10px' : '0px');
  return (
    <div style={{ display: 'flex', justifyContent: justify, padding: '12px 0', opacity: el.opacity !== undefined ? el.opacity : 1 }}>
      <div
        style={
          hasPlate
            ? {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: plateBg,
                padding: padVal,
                borderRadius: el.borderRadius || '14px',
                boxShadow: resolveShadowStyle(el.shadow),
                border: el.borderColor
                  ? resolveBorderStyle('solid', el.borderWidth || 1, el.borderColor)
                  : undefined,
              }
            : undefined
        }
      >
        <img src={el.src} alt="Logo" style={{ width: el.width, height: 'auto', objectFit: 'contain', display: 'block' }} />
      </div>
    </div>
  );
}

function buildTypographyStyle(
  el: TitleElement | DescriptionElement,
  defaults: { fontWeight: number; padding: string; align: 'left' | 'center' | 'right' | 'justify' }
): React.CSSProperties {
  const hasBox = Boolean(
    (el.bgColor && el.bgColor !== 'transparent') ||
      el.backdropBlur ||
      el.borderColor ||
      el.paddingX !== undefined ||
      el.paddingY !== undefined
  );
  const padY = el.paddingY !== undefined ? `${el.paddingY}px` : hasBox ? '8px' : undefined;
  const padX = el.paddingX !== undefined ? `${el.paddingX}px` : hasBox ? '14px' : undefined;
  const style: React.CSSProperties = {
    padding: padY || padX ? `${padY || '6px'} ${padX || '0px'}` : defaults.padding,
    textAlign: el.align || defaults.align,
    color: el.color,
    fontSize: el.fontSize,
    fontFamily: el.fontFamily || undefined,
    fontWeight: el.fontWeight !== undefined ? el.fontWeight : defaults.fontWeight,
    fontStyle: el.fontStyle || 'normal',
    textDecoration: el.textDecoration && el.textDecoration !== 'none' ? el.textDecoration : undefined,
    textTransform: el.textTransform && el.textTransform !== 'none' ? el.textTransform : undefined,
    lineHeight: el.lineHeight !== undefined ? el.lineHeight : undefined,
    letterSpacing:
      typeof el.letterSpacing === 'number'
        ? `${el.letterSpacing}px`
        : el.letterSpacing || undefined,
    margin: 0,
    whiteSpace: 'pre-line',
    backgroundColor: applyColorOpacity(el.bgColor, el.bgOpacity),
    borderRadius: el.borderRadius || (hasBox ? '12px' : undefined),
    backdropFilter: el.backdropBlur ? `blur(${el.backdropBlur}px)` : undefined,
    border: el.borderColor
      ? resolveBorderStyle('solid', el.borderWidth || 1, el.borderColor)
      : undefined,
  };
  const resolvedShadow = resolveTextShadow(el.textShadow);
  if (resolvedShadow) style.textShadow = resolvedShadow;
  const strokeWidth =
    el.textStrokeWidth !== undefined
      ? `${el.textStrokeWidth}px`
      : el.textStroke && el.textStroke !== '0px' && el.textStroke !== '0'
      ? /^\d+(\.\d+)?$/.test(String(el.textStroke).trim())
        ? `${String(el.textStroke).trim()}px`
        : el.textStroke
      : undefined;
  if (strokeWidth) {
    (style as Record<string, unknown>).WebkitTextStroke = `${strokeWidth} ${el.textStrokeColor || '#000000'}`;
  }
  if (el.textGradient) {
    style.backgroundImage = el.textGradient;
    style.WebkitBackgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    style.backgroundClip = 'text';
  }
  return style;
}

function TitleRenderer({ el }: { el: TitleElement }) {
  const style = buildTypographyStyle(el, { fontWeight: 700, padding: '8px 0', align: 'center' });
  return <h1 style={style}>{el.content}</h1>;
}

function DescriptionRenderer({ el }: { el: DescriptionElement }) {
  const style = buildTypographyStyle(el, { fontWeight: 400, padding: '4px 0', align: 'center' });
  return <p style={style}>{el.content}</p>;
}

function ImageRenderer({ el, isDesktop }: { el: ImageElement; isDesktop?: boolean }) {
  const imgSrc = isDesktop && el.srcDesktop ? el.srcDesktop : el.src;
  if (!imgSrc) {
    return (
      <div style={{ padding: '6px 0', width: '100%', height: '100%', minHeight: '120px' }}>
        <div style={{ width: '100%', height: '100%', minHeight: '120px', border: '2px dashed #94a3b8', borderRadius: el.borderRadius || '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.18)', color: '#475569', fontSize: '13px', gap: '4px', backdropFilter: 'blur(4px)' }}>
          <span className="font-semibold text-slate-700">🖼️ Hình ảnh (Chưa có ảnh)</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }} className="text-slate-500">Tải ảnh hoặc dán URL ở bảng Thuộc tính bên phải</span>
        </div>
      </div>
    );
  }

  const zoom = el.zoom || 1;
  const posX = el.posX || 0;
  const posY = el.posY || 0;

  const shadowStyle = resolveShadowStyle(el.shadow);
  const borderStyle = resolveBorderStyle(el.borderStyle, el.borderWidth, el.borderColor);
  const filterCss = buildMediaFilterCss({
    brightness: el.brightness,
    contrast: el.contrast,
    saturate: el.saturate,
    grayscale: el.grayscale,
    blur: el.blur,
  });

  let effectiveRadius = el.borderRadius || '12px';
  if (el.maskShape === 'circle' || el.maskShape === 'pill') effectiveRadius = '9999px';
  else if (el.maskShape === 'arch') effectiveRadius = '9999px 9999px 16px 16px';
  else if (el.maskShape === 'rect') effectiveRadius = '0px';

  const effectiveAspect =
    el.maskShape === 'circle'
      ? '1/1'
      : el.aspectRatio && el.aspectRatio !== 'auto'
      ? el.aspectRatio
      : undefined;

  return (
    <div style={{ padding: '4px 0', width: '100%', opacity: el.opacity !== undefined ? el.opacity : 1 }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: effectiveRadius,
          width: el.width || '100%',
          height: effectiveAspect ? 'auto' : el.height === 'auto' ? 'auto' : el.height,
          aspectRatio: effectiveAspect,
          boxShadow: shadowStyle,
          border: borderStyle,
          transition: 'all 0.2s ease',
        }}
      >
        <img
          src={imgSrc}
          alt={el.alt || 'Hình ảnh'}
          style={{
            width: '100%',
            height: el.height === 'auto' && !effectiveAspect ? 'auto' : '100%',
            objectFit: el.objectFit || 'cover',
            objectPosition: `calc(50% + ${posX}px) calc(50% + ${posY}px)`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            filter: filterCss,
            display: 'block',
          }}
        />
        {el.caption && el.captionPosition !== 'below' && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '10px 12px',
              background: el.captionBgColor || 'linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.82) 100%)',
              color: el.captionColor || '#ffffff',
              fontSize: '12px',
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {el.caption}
          </div>
        )}
      </div>
      {el.caption && el.captionPosition === 'below' && (
        <p
          style={{
            marginTop: '6px',
            marginBottom: 0,
            fontSize: '12px',
            color: el.captionColor || '#e2e8f0',
            textAlign: 'center',
          }}
        >
          {el.caption}
        </p>
      )}
    </div>
  );
}

function ImageSliderRenderer({ el, isDesktop }: { el: ImageSliderElement; isDesktop?: boolean }) {
  const [current, setCurrent] = useState(0);
  const images = isDesktop && el.imagesDesktop && el.imagesDesktop.length > 0 ? el.imagesDesktop : (el.images || []);
  const height = isDesktop && el.heightDesktop ? el.heightDesktop : (el.height || '220px');
  const touchStartX = useRef(0);
  useEffect(() => setCurrent(0), [isDesktop, el.id, images.length]);

  useEffect(() => {
    if (!el.autoplay || images.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % images.length), (el.interval || 3) * 1000);
    return () => clearInterval(timer);
  }, [el.autoplay, el.interval, images.length]);

  if (images.length === 0) {
    return (
      <div style={{ padding: '6px 0', width: '100%' }}>
        <div
          style={{
            width: '100%',
            height: height || '180px',
            border: '2px dashed #94a3b8',
            borderRadius: el.borderRadius || '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.18)',
            color: '#475569',
            fontSize: '13px',
            gap: '4px',
            padding: '16px',
            boxSizing: 'border-box',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="font-semibold text-slate-700">🎠 Slider ảnh (Chưa có ảnh)</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }} className="text-slate-500">Thêm và tải ảnh slide ở bảng Thuộc tính</span>
        </div>
      </div>
    );
  }

  const prevSlide = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const nextSlide = () => setCurrent((c) => (c + 1) % images.length);
  const shadowStyle = resolveShadowStyle(el.shadow || 'md');
  const borderStyle = resolveBorderStyle(el.borderStyle, el.borderWidth, el.borderColor);
  const showArrows = el.showArrows !== false;
  const showDots = el.showDots !== false;
  const isSlideMode = el.transitionType === 'slide';
  const currentImg = images[current];

  return (
    <div style={{ padding: '4px 0', width: '100%' }}>
      <div
        className="portal-image-slider group relative overflow-hidden"
        style={{
          borderRadius: el.borderRadius || '14px',
          height,
          position: 'relative',
          touchAction: 'pan-y',
          boxShadow: shadowStyle,
          border: borderStyle !== 'none' ? borderStyle : undefined,
        }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 40) {
            if (diff > 0) nextSlide();
            else prevSlide();
          }
        }}
      >
        {images.map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.alt || ''}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: el.objectFit || 'cover',
              transition: isSlideMode ? 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease' : 'opacity 0.6s ease-in-out',
              opacity: i === current ? 1 : isSlideMode ? 0.4 : 0,
              transform: isSlideMode ? `translateX(${(i - current) * 100}%)` : undefined,
              pointerEvents: i === current ? 'auto' : 'none',
            }}
          />
        ))}

        {/* Slide Caption Overlay */}
        {el.showCaptions !== false && currentImg && (currentImg.title || currentImg.subtitle || currentImg.badge) && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: showDots && images.length > 1 ? '18px 14px 28px' : '14px',
              background: 'linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.85) 100%)',
              color: '#ffffff',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            {currentImg.badge && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                {currentImg.badge}
              </span>
            )}
            {currentImg.title && (
              <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.25 }}>{currentImg.title}</div>
            )}
            {currentImg.subtitle && (
              <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>{currentImg.subtitle}</div>
            )}
          </div>
        )}

        {/* Counter Badge */}
        {images.length > 1 && (
          <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono font-medium tracking-wider">
            {current + 1} / {images.length}
          </div>
        )}

        {/* Left / Right Navigation Controls */}
        {images.length > 1 && showArrows && (
          <>
            <button
              onClick={prevSlide}
              type="button" aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-80 group-hover:opacity-100 focus-visible:opacity-100"
            >
              ‹
            </button>
            <button
              onClick={nextSlide}
              type="button" aria-label="Ảnh tiếp theo"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-80 group-hover:opacity-100 focus-visible:opacity-100"
            >
              ›
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {images.length > 1 && showDots && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '6px',
              zIndex: 2,
              padding: '3px 8px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '999px',
              backdropFilter: 'blur(4px)',
            }}
          >
            {images.map((_, i) => (
              <button
                type="button"
                key={i}
                aria-label={`Xem ảnh ${i + 1}`}
                aria-pressed={i === current}
                onClick={() => setCurrent(i)}
                style={{ width: 28, height: 28, border: 0, background: 'transparent', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
              >
                <span aria-hidden="true" style={{ display: 'block', width: i === current ? 18 : 6, height: 6, borderRadius: 3, background: i === current ? '#ffffff' : 'rgba(255,255,255,0.65)' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoRenderer({ el, isDesktop, autoPlayTrigger }: { el: VideoElement; isDesktop?: boolean; autoPlayTrigger?: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const aspectMap: Record<string, string> = {
    '16:9': '16/9',
    '9:16': '9/16',
    '4:3': '4/3',
    '1:1': '1/1',
    'auto': 'auto',
  };
  const frameWidth = isDesktop ? (el.frameWidthDesktop || el.frameWidth || '100%') : (el.frameWidth || '100%');

  const shadowStyle = resolveShadowStyle(el.shadow || 'md');
  const borderStyle = resolveBorderStyle(el.borderStyle, el.borderWidth, el.borderColor);

  // Programmatically trigger autoplay when all overlays are gone
  useEffect(() => {
    if (!autoPlayTrigger || !el.autoplay) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = el.muted ?? false;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }, [autoPlayTrigger, el.autoplay, el.muted]);

  if (!el.src) {
    return (
      <div style={{ padding: '6px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: frameWidth,
            maxWidth: '100%',
            height: '160px',
            border: '2px dashed #94a3b8',
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15,23,42,0.6)',
            color: '#cbd5e1',
            fontSize: '13px',
            gap: '6px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl shadow-inner">
            🎬
          </div>
          <span className="font-semibold text-white">Video (Chưa có nội dung)</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }} className="text-slate-300">Tải video hoặc dán link ở bảng Thuộc tính bên phải</span>
        </div>
      </div>
    );
  }

  const isVertical = el.aspectRatio === '9:16';

  return (
    <div style={{ padding: '6px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        className="relative group"
        style={{
          width: isVertical ? (isDesktop ? 'min(300px, 100%)' : 'min(260px, 90%)') : frameWidth,
          maxWidth: '100%',
          borderRadius: el.borderRadius || '14px',
          overflow: 'hidden',
          aspectRatio: aspectMap[el.aspectRatio || 'auto'] || 'auto',
          background: '#090d16',
          boxShadow: shadowStyle,
          border: borderStyle !== 'none' ? borderStyle : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <video
          ref={videoRef}
          src={el.src}
          muted={el.muted}
          loop={el.loop}
          playsInline
          poster={el.poster || undefined}
          controls={el.controls}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
        />

        {/* Aspect ratio & video badge indicator */}
        <div className="absolute top-2 left-2 pointer-events-none px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/90 flex items-center gap-1 border border-white/10">
          <span>{el.aspectRatio === '9:16' ? '📱 9:16 Dọc Reels' : '🎬 16:9 HD'}</span>
        </div>
      </div>
    </div>
  );
}

function SpacerRenderer({ el, isDesktop }: { el: SpacerElement; isDesktop?: boolean }) {
  const height = isDesktop ? (el.heightDesktop || el.height || '20px') : (el.height || '20px');
  return <div style={{ height }} />;
}

export function getDialogMaxWidth(
  size?: 'normal' | 'large' | 'xlarge' | 'cinematic' | 'fullscreen',
  customDesktop?: string,
  customMobile?: string,
  isDesktop?: boolean
): string {
  if (size === 'fullscreen') return isDesktop ? '95vw' : '96vw';
  if (size === 'cinematic') return isDesktop ? '1060px' : '96vw';
  if (size === 'xlarge') return isDesktop ? '900px' : '95vw';
  if (size === 'large') return isDesktop ? '740px' : '94vw';
  if (size === 'normal') return isDesktop ? '560px' : '92vw';
  if (isDesktop && customDesktop) return customDesktop;
  if (customMobile) return customMobile;
  return isDesktop ? '720px' : '94vw';
}

export function getDialogThemeStyles(theme?: 'luxury_gold' | 'cinematic_dark' | 'glass_neon' | 'clean_light') {
  switch (theme) {
    case 'luxury_gold':
      return {
        cardBg: 'linear-gradient(155deg, #091322 0%, #0e1e35 45%, #07101c 100%)',
        cardBorder: '1.5px solid rgba(212, 175, 55, 0.75)',
        cardBoxShadow: '0 25px 65px -10px rgba(0, 0, 0, 0.95), 0 0 40px -5px rgba(212, 175, 55, 0.4)',
        headerBadgeBg: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(245,222,179,0.12))',
        headerBadgeBorder: '1px solid rgba(212, 175, 55, 0.65)',
        headerBadgeText: '#fde047',
        titleColor: '#ffffff',
        titleTextShadow: '0 2px 14px rgba(212, 175, 55, 0.45)',
        messageColor: '#e2e8f0',
        buttonBg: 'linear-gradient(135deg, #ca8a04 0%, #eab308 50%, #fef08a 100%)',
        buttonColor: '#0f172a',
        buttonBorder: '1px solid #fef08a',
        buttonShadow: '0 8px 25px -4px rgba(234, 179, 8, 0.65)',
        waitBadgeBg: 'rgba(212, 175, 55, 0.18)',
        waitBadgeBorder: '1px solid rgba(212, 175, 55, 0.45)',
        waitBadgeText: '#fef08a',
        waitCounterBg: '#eab308',
        waitCounterText: '#0f172a',
        isDark: true,
        ornament: '✨',
      };
    case 'cinematic_dark':
      return {
        cardBg: 'linear-gradient(150deg, #0f172a 0%, #1e293b 100%)',
        cardBorder: '1px solid rgba(255, 255, 255, 0.15)',
        cardBoxShadow: '0 30px 75px -10px rgba(0, 0, 0, 0.95), 0 0 40px rgba(37, 99, 235, 0.3)',
        headerBadgeBg: 'rgba(37, 99, 235, 0.25)',
        headerBadgeBorder: '1px solid rgba(59, 130, 246, 0.5)',
        headerBadgeText: '#93c5fd',
        titleColor: '#ffffff',
        titleTextShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
        messageColor: '#94a3b8',
        buttonBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        buttonColor: '#ffffff',
        buttonBorder: '1px solid rgba(96, 165, 250, 0.5)',
        buttonShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.5)',
        waitBadgeBg: 'rgba(255, 255, 255, 0.08)',
        waitBadgeBorder: '1px solid rgba(255, 255, 255, 0.15)',
        waitBadgeText: '#cbd5e1',
        waitCounterBg: '#2563eb',
        waitCounterText: '#ffffff',
        isDark: true,
        ornament: '🎬',
      };
    case 'glass_neon':
      return {
        cardBg: 'rgba(15, 23, 42, 0.85)',
        cardBorder: '1px solid rgba(56, 189, 248, 0.5)',
        cardBoxShadow: '0 25px 65px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.35)',
        headerBadgeBg: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(168,85,247,0.25))',
        headerBadgeBorder: '1px solid rgba(56, 189, 248, 0.6)',
        headerBadgeText: '#38bdf8',
        titleColor: '#ffffff',
        titleTextShadow: '0 0 16px rgba(56, 189, 248, 0.7)',
        messageColor: '#e2e8f0',
        buttonBg: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
        buttonColor: '#ffffff',
        buttonBorder: '1px solid rgba(56, 189, 248, 0.6)',
        buttonShadow: '0 8px 25px -4px rgba(56, 189, 248, 0.6)',
        waitBadgeBg: 'rgba(56, 189, 248, 0.15)',
        waitBadgeBorder: '1px solid rgba(56, 189, 248, 0.35)',
        waitBadgeText: '#bae6fd',
        waitCounterBg: '#0284c7',
        waitCounterText: '#ffffff',
        isDark: true,
        ornament: '⚡',
      };
    case 'clean_light':
    default:
      return {
        cardBg: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        cardBorder: '1px solid #e2e8f0',
        cardBoxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0,0,0,0.05)',
        headerBadgeBg: '#eff6ff',
        headerBadgeBorder: '1px solid #dbeafe',
        headerBadgeText: '#2563eb',
        titleColor: '#0f172a',
        titleTextShadow: 'none',
        messageColor: '#64748b',
        buttonBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        buttonColor: '#ffffff',
        buttonBorder: 'none',
        buttonShadow: '0 6px 18px -2px rgba(37, 99, 235, 0.35)',
        waitBadgeBg: '#f1f5f9',
        waitBadgeBorder: '1px solid #e2e8f0',
        waitBadgeText: '#475569',
        waitCounterBg: '#2563eb',
        waitCounterText: '#ffffff',
        isDark: false,
        ornament: '📢',
      };
  }
}

function VideoGateMockupRenderer({ el, isDesktop }: { el: VideoGateElement; isDesktop?: boolean }) {
  const aspectMap: Record<string, string> = {
    '16:9': '16/9',
    '9:16': '9/16',
    '4:3': '4/3',
    'auto': '16/9',
  };
  const isVertical = el.aspectRatio === '9:16';
  const theme = getDialogThemeStyles(el.dialogTheme);
  const maxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  return (
    <div style={{ padding: '8px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth,
          background: theme.cardBg,
          borderRadius: el.borderRadius || '22px',
          boxShadow: theme.cardBoxShadow,
          border: theme.cardBorder,
          overflow: 'hidden',
          textAlign: 'center',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Header with pill badge */}
        <div style={{ padding: '16px 20px 10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: theme.headerBadgeText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: theme.headerBadgeBg,
              border: theme.headerBadgeBorder,
              padding: '3px 12px',
              borderRadius: '999px',
              marginBottom: '8px',
            }}
          >
            <span>{theme.ornament} Video Gate Quảng cáo</span>
          </div>
          <h3 style={{ margin: 0, fontSize: isDesktop ? '17px' : '15px', fontWeight: 700, color: theme.titleColor, textShadow: theme.titleTextShadow, lineHeight: 1.3 }}>
            {el.dialogTitle || 'Xem video để kết nối WiFi'}
          </h3>
          <p style={{ margin: '5px 0 0', fontSize: isDesktop ? '13px' : '12px', color: theme.messageColor, lineHeight: 1.45 }}>
            {el.dialogMessage || 'Vui lòng xem hết video ngắn để nhận quyền truy cập WiFi tốc độ cao.'}
          </p>
        </div>

        {/* Video Player Mockup */}
        <div style={{ padding: '6px 16px', position: 'relative' }}>
          <div
            style={{
              width: '100%',
              aspectRatio: aspectMap[el.aspectRatio || '16:9'] || '16/9',
              maxHeight: isVertical ? '380px' : '280px',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
            }}
          >
            {el.videoUrl ? (
              <video
                src={el.videoUrl}
                poster={el.poster || undefined}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : el.poster ? (
              <img src={el.poster} alt="Poster video gate" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">
                  📹
                </div>
                <span className="font-semibold text-slate-200">Chưa có video</span>
                <span style={{ fontSize: '11px', opacity: 0.75 }}>Tải video hoặc dán link URL ở cột thuộc tính</span>
              </div>
            )}

            {/* Countdown Badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(6px)',
                color: 'white',
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>⏱️ Bỏ qua sau {el.skipAfter ?? 5}s</span>
            </div>

            {/* Aspect Ratio Badge */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(6px)',
                color: '#93c5fd',
                fontSize: '10px',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {isVertical ? '📱 9:16 Dọc' : '🎬 16:9 Ngang'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ padding: '12px 18px 18px' }}>
          <div
            style={{
              width: '100%',
              padding: '12px 20px',
              background: theme.buttonBg,
              color: theme.buttonColor,
              border: theme.buttonBorder,
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              boxShadow: theme.buttonShadow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span>Tiếp tục kết nối WiFi</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceGateMockupRenderer({ el, isDesktop }: { el: AttendanceGateElement; isDesktop?: boolean }) {
  const theme = getDialogThemeStyles(el.dialogTheme);
  const maxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  return (
    <div style={{ padding: '8px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth,
          background: theme.cardBg,
          borderRadius: el.borderRadius || '22px',
          boxShadow: theme.cardBoxShadow,
          border: theme.cardBorder,
          overflow: 'hidden',
          textAlign: 'center',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Header with badge */}
        <div style={{ padding: '18px 20px 12px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              color: theme.headerBadgeText,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: theme.headerBadgeBg,
              border: theme.headerBadgeBorder,
              padding: '3px 12px',
              borderRadius: '999px',
              marginBottom: '8px',
            }}
          >
            <span>{theme.ornament} Điểm danh cuộc họp</span>
          </div>
          <h3 style={{ margin: 0, fontSize: isDesktop ? '17px' : '15px', fontWeight: 700, color: theme.titleColor, textShadow: theme.titleTextShadow, lineHeight: 1.3 }}>
            {el.dialogTitle || 'Điểm danh cuộc họp'}
          </h3>
          <p style={{ margin: '5px 0 0', fontSize: isDesktop ? '13px' : '12px', color: theme.messageColor, lineHeight: 1.45 }}>
            {el.dialogMessage || 'Vui lòng nhập Họ tên và Phòng ban để hoàn tất điểm danh và kết nối WiFi.'}
          </p>
        </div>

        {/* 2 Fields Mockup */}
        <div style={{ padding: '4px 20px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: theme.titleColor, marginBottom: '4px' }}>
              {el.nameLabel || 'Họ và tên'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: theme.isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
              color: theme.titleColor,
              fontSize: '12px',
            }}>
              {el.namePlaceholder || 'VD: Nguyễn Văn A'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: theme.titleColor, marginBottom: '4px' }}>
              {el.departmentLabel || 'Phòng ban / Đơn vị'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: theme.isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc',
              color: theme.titleColor,
              fontSize: '12px',
            }}>
              {el.departmentPlaceholder || 'VD: Ban Biên tập Chính trị'}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ padding: '0 20px 18px' }}>
          <div
            style={{
              width: '100%',
              padding: '12px 20px',
              background: theme.buttonBg,
              color: theme.buttonColor,
              border: theme.buttonBorder,
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              boxShadow: theme.buttonShadow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <span>{el.buttonText || 'Xác nhận điểm danh & Kết nối'}</span>
            <span>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnouncementMockupRenderer({ el, isDesktop }: { el: AnnouncementElement; isDesktop?: boolean }) {
  const theme = getDialogThemeStyles(el.dialogTheme);
  const maxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  return (
    <div style={{ padding: '8px 0', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth,
          background: el.bgColor || theme.cardBg,
          borderRadius: el.borderRadius || '22px',
          boxShadow: theme.cardBoxShadow,
          border: theme.cardBorder,
          overflow: 'hidden',
          textAlign: 'center',
          transition: 'all 0.25s ease',
        }}
      >
        {el.imageUrl && (
          <img src={el.imageUrl} alt={el.title} style={{ width: '100%', maxHeight: '220px', objectFit: 'cover' }} />
        )}
        <div style={{ padding: '18px 20px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 700,
              color: theme.headerBadgeText,
              textTransform: 'uppercase',
              background: theme.headerBadgeBg,
              border: theme.headerBadgeBorder,
              padding: '3px 10px',
              borderRadius: '999px',
              marginBottom: '10px',
            }}
          >
            <span>{theme.ornament} Thông báo ưu đãi</span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: el.titleFontSize || '17px',
              fontWeight: el.titleBold ? 700 : 600,
              fontStyle: el.titleItalic ? 'italic' : 'normal',
              color: el.titleColor || theme.titleColor,
              textShadow: theme.titleTextShadow,
              lineHeight: 1.3,
            }}
          >
            {el.title || 'Tiêu đề thông báo'}
          </h3>
          <p
            style={{
              margin: '8px 0 16px',
              fontSize: el.messageFontSize || '13px',
              color: el.messageColor || theme.messageColor,
              lineHeight: 1.5,
            }}
          >
            {el.message || 'Nội dung thông báo giới thiệu ưu đãi hoặc dịch vụ đặc biệt.'}
          </p>
          <div
            style={{
              width: '100%',
              padding: '12px',
              background: el.buttonBgColor || theme.buttonBg,
              color: el.buttonTextColor || theme.buttonColor,
              border: theme.buttonBorder,
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              boxShadow: theme.buttonShadow,
            }}
          >
            {el.buttonText || 'Tiếp tục'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectButtonRenderer({
  el,
  params,
  isPreview,
  redirectUrl,
  campaignId,
  isDesktop,
  onSimulateConnect,
  onConnectionStart,
  portalSessionId,
}: {
  el: ConnectButtonElement;
  params: Partial<PortalParams>;
  isPreview?: boolean;
  redirectUrl?: string;
  campaignId?: string;
  isDesktop?: boolean;
  onSimulateConnect?: () => void;
  onConnectionStart?: () => void;
  portalSessionId?: string;
}) {
  const [phone, setPhone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const pendingConnect = useRef(false);
  useEffect(() => setImageFailed(false), [el.imageSrc]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const buttonWidth = isDesktop ? (el.buttonWidthDesktop || el.buttonWidth || '100%') : (el.buttonWidth || '100%');

  const handleConnect = () => {
    if (el.requireConfirm && !confirmed) return;
    if (onSimulateConnect) { onSimulateConnect(); return; }
    if (isPreview || submitting || pendingConnect.current) return;
    pendingConnect.current = true;

    setErrorMessage('');
    setSubmitting(true);

    try {
      const rawParams = params as Record<string, string | undefined>;
      const mac = rawParams.mac || rawParams['mac-address'] || rawParams.MAC || '';
      const ip = rawParams.ip || rawParams['ip-address'] || rawParams.IP || '';
      const ssid = rawParams.ssid || rawParams.SSID || rawParams['ssid-name'] || '';
      const linkLogin =
        rawParams['link-login'] ||
        rawParams['link-login-only'] ||
        rawParams.linkLogin ||
        rawParams.linklogin ||
        rawParams.linkLoginOnly ||
        '';
      const trial =
        rawParams.trial ||
        rawParams['link-trial'] ||
        rawParams.linktrial ||
        rawParams['link-login-only'] ||
        rawParams.linkLoginOnly ||
        '';

      const connectUrl = new URL('/api/connect', window.location.origin);
      if (mac) connectUrl.searchParams.set('mac', mac);
      if (ip) connectUrl.searchParams.set('ip', ip);
      if (ssid) connectUrl.searchParams.set('ssid', ssid);
      if (params.apMac) connectUrl.searchParams.set('apMac', params.apMac);
      if (params.unifiSite) connectUrl.searchParams.set('unifiSite', params.unifiSite);
      if (phone) connectUrl.searchParams.set('phone', phone);
      if (trial) connectUrl.searchParams.set('trial', trial);
      if (linkLogin) connectUrl.searchParams.set('link-login', linkLogin);
      if (redirectUrl) connectUrl.searchParams.set('redirectUrl', redirectUrl);
      if (campaignId) connectUrl.searchParams.set('campaignId', campaignId);
      if (portalSessionId) connectUrl.searchParams.set('portalSessionId', portalSessionId);

      onConnectionStart?.();
      setSubmitted(true);
      window.location.href = connectUrl.toString();
    } catch (err) {
      console.error('Lỗi kết nối:', err);
      setErrorMessage('Không thể kết nối. Vui lòng thử lại.');
      pendingConnect.current = false;
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" aria-live="polite" style={{ padding: '12px 0', textAlign: 'center', color: 'inherit' }}>
        <p style={{ fontSize: '15px', fontWeight: 600 }}>Đang xử lý kết nối WiFi…</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Vui lòng đợi chuyển hướng.</p>
      </div>
    );
  }

  // Button background & borders
  let buttonBg = el.bgColor || '#2563eb';
  let buttonBorder = el.borderColor
    ? resolveBorderStyle('solid', el.borderWidth || 1, el.borderColor)
    : 'none';
  let textColor = el.color || '#ffffff';

  if (el.buttonStyle === 'gradient') {
    if (typeof el.gradient === 'string' && el.gradient.trim()) {
      buttonBg = el.gradient;
    } else if (el.gradient && typeof el.gradient === 'object' && el.gradient.css?.trim()) {
      buttonBg = el.gradient.css;
    } else if (el.gradient && typeof el.gradient === 'object') {
      const from = el.gradient.from || el.bgColor || '#2563eb';
      const to = el.gradient.to || '#1d4ed8';
      const angle = el.gradient.angle ?? 135;
      buttonBg = el.gradient.via
        ? `linear-gradient(${angle}deg, ${from} 0%, ${el.gradient.via} 50%, ${to} 100%)`
        : `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
    } else {
      buttonBg = `linear-gradient(135deg, ${el.bgColor || '#2563eb'} 0%, #1d4ed8 100%)`;
    }
  } else if (el.buttonStyle === 'glass') {
    buttonBg = 'rgba(255, 255, 255, 0.22)';
    buttonBorder = el.borderColor
      ? resolveBorderStyle('solid', el.borderWidth || 1, el.borderColor)
      : '1px solid rgba(255, 255, 255, 0.45)';
    textColor = el.color || '#ffffff';
  } else if (el.buttonStyle === 'outline') {
    buttonBg = 'transparent';
    buttonBorder = `${typeof el.borderWidth === 'number' ? `${el.borderWidth}px` : el.borderWidth || '2px'} solid ${el.borderColor || el.bgColor || '#2563eb'}`;
    textColor = el.color || el.bgColor || '#2563eb';
  }

  // Shadow preset
  let buttonShadow = resolveShadowStyle(el.shadow || 'md', applyColorOpacity(el.bgColor || '#2563eb', 0.44));
  if (el.buttonEffect === 'glow') {
    buttonShadow = `0 0 16px 1px ${applyColorOpacity(el.bgColor || '#2563eb', 0.4)}, ${buttonShadow !== 'none' ? buttonShadow : '0 4px 14px rgba(0,0,0,0.15)'}`;
  } else if (el.buttonEffect === 'lift') {
    buttonShadow = `0 4px 0 rgba(15,23,42,0.35), ${buttonShadow !== 'none' ? buttonShadow : '0 8px 20px rgba(0,0,0,0.22)'}`;
  }

  const padY = typeof el.paddingY === 'number' ? `${el.paddingY}px` : el.paddingY || '14px';
  const btnFontStyle: React.CSSProperties = {
    fontFamily: el.fontFamily || undefined,
    fontSize: el.fontSize || '16px',
    fontWeight: el.fontWeight !== undefined ? el.fontWeight : 600,
    fontStyle: el.fontStyle || 'normal',
    textTransform: el.textTransform && el.textTransform !== 'none' ? el.textTransform : undefined,
    letterSpacing: typeof el.letterSpacing === 'number' ? `${el.letterSpacing}px` : el.letterSpacing || undefined,
  };

  // Render Icon
  const renderIcon = () => {
    if (el.buttonIcon === 'wifi') {
      return (
        <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
        </svg>
      );
    }
    if (el.buttonIcon === 'lightning') {
      return (
        <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle', color: '#fcd34d' }} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    }
    if (el.buttonIcon === 'arrow') {
      return (
        <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginLeft: '8px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    }
    if (el.buttonIcon === 'shield') {
      return (
        <svg style={{ width: '18px', height: '18px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '8px 0', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: buttonWidth, maxWidth: '100%' }}>
        {/* Phone number input field preview */}
        {el.showPhone && (
          <div style={{ position: 'relative', marginBottom: '8px', width: '100%' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#64748b' }}>
              📱
            </span>
            <input
              type="tel"
              placeholder={el.phonePlaceholder || 'Nhập số điện thoại nhận ưu đãi'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 38px',
                border: '1px solid rgba(203, 213, 225, 0.8)',
                borderRadius: el.radius || '12px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#1e293b',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            />
          </div>
        )}

        {/* Custom Image Button or CSS Button */}
        <button
          type="button"
          className="portal-connect-button"
          data-effect={isPreview && !onSimulateConnect ? 'none' : el.buttonEffect || 'none'}
          onClick={handleConnect}
          disabled={submitting || (!!el.requireConfirm && !confirmed)}
          aria-busy={submitting}
          aria-label={el.text || 'Kết nối ngay'}
          style={{
            position: 'relative', overflow: 'hidden', width: '100%', minHeight: 44,
            padding: el.imageSrc && !imageFailed ? 0 : `${padY} 20px`,
            background: buttonBg, color: textColor, border: buttonBorder,
            borderRadius: el.radius || '8px', ...btnFontStyle,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting || (el.requireConfirm && !confirmed) ? 0.6 : 1,
            boxShadow: buttonShadow,
            backdropFilter: el.buttonStyle === 'glass' ? 'blur(12px)' : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          {el.imageSrc && !imageFailed ? <img src={el.imageSrc} alt="" onError={() => setImageFailed(true)} style={{width: isDesktop ? (el.imageWidthDesktop || el.imageWidth || '100%') : (el.imageWidth || '100%'), maxWidth:'100%', display:'block', borderRadius:'inherit'}} /> : <>
            {el.buttonEffect === 'shimmer' && <span aria-hidden="true" className="portal-connect-shimmer" />}
            {el.buttonIcon !== 'arrow' && renderIcon()}
            <span style={{position:'relative'}}>{submitting ? 'Đang kết nối WiFi…' : el.text || 'Kết nối ngay'}</span>
            {el.buttonIcon === 'arrow' && renderIcon()}
          </>}
        </button>
        {el.requireConfirm && <label style={{display:'flex', gap:8, alignItems:'flex-start', marginTop:12, fontSize:13, lineHeight:1.5, color:'inherit', cursor:'pointer'}}>
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} style={{marginTop:3, width:16, height:16, flexShrink:0}} />
          <span>Tôi đồng ý với {el.termsText || 'điều khoản truy cập WiFi.'}</span>
        </label>}

        {/* Terms of service disclaimer text */}
        {el.termsText && !el.requireConfirm && (
          <p
            style={{
              fontSize: '11px',
              color: 'inherit',
              textAlign: 'center',
              marginTop: '8px',
              lineHeight: 1.4,
              opacity: 0.85,
            }}
          >
            {el.termsText}
          </p>
        )}

        {errorMessage && (
          <p role="alert" style={{ fontSize: '12px', color: '#b91c1c', textAlign: 'center', marginTop: '8px' }}>
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
