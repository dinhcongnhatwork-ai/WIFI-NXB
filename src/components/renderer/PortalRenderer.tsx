'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}

export default function PortalRenderer({ config, params, isPreview, redirectUrl, campaignId, previewMode }: Props) {
  const bg = config.background;
  const [autoDesktop, setAutoDesktop] = useState(false);
  const [videoGateDismissed, setVideoGateDismissed] = useState(false);
  const [attendanceGateDismissed, setAttendanceGateDismissed] = useState(false);

  // Auto-detect desktop on the real portal (non-preview)
  useEffect(() => {
    if (!isPreview && !previewMode) {
      const checkWidth = () => setAutoDesktop(window.innerWidth >= 768);
      checkWidth();
      window.addEventListener('resize', checkWidth);
      return () => window.removeEventListener('resize', checkWidth);
    }
  }, [isPreview, previewMode]);

  const isDesktop = previewMode ? (previewMode === 'desktop' || previewMode === 'tablet') : autoDesktop;
  const bgImage = isDesktop ? (bg.imageDesktop || bg.imageMobile) : (bg.imageMobile || bg.imageDesktop);
  const bgVideo = isDesktop ? (bg.videoDesktop || bg.videoMobile) : (bg.videoMobile || bg.videoDesktop);

  const videoGateEl = config.elements.find(el => el.type === 'video_gate' && el.enabled) as VideoGateElement | undefined;
  const announcementEl = config.elements.find(el => el.type === 'announcement' && el.enabled) as AnnouncementElement | undefined;
  const attendanceGateEl = config.elements.find(el => el.type === 'attendance_gate' && el.enabled) as AttendanceGateElement | undefined;

  const hasVideoGate = !isPreview && !!videoGateEl && !!videoGateEl.videoUrl;
  const hasAnnouncement = !isPreview && !!announcementEl;
  const hasAttendanceGate = !isPreview && !!attendanceGateEl;

  // Trigger auto-play on inline video once ALL overlays are gone
  const autoPlayTrigger = !hasVideoGate && !hasAnnouncement && !hasAttendanceGate ? 1 : (videoGateDismissed && attendanceGateDismissed) ? 2 : 0;

  const showVideoGate = hasVideoGate && !videoGateDismissed;
  const showAttendanceGate = hasAttendanceGate && !attendanceGateDismissed && (!hasVideoGate || videoGateDismissed);
  const showAnnouncement = !isPreview && !!announcementEl && (!hasVideoGate || videoGateDismissed) && (!hasAttendanceGate || attendanceGateDismissed);

  const isOverlayActive = showVideoGate || showAttendanceGate || showAnnouncement;

  return (
    <div className="portal-page" style={{ minHeight: isPreview ? '100%' : '100vh', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: isPreview ? 'absolute' : 'fixed', inset: 0, zIndex: 0 }}>
        {bgVideo ? (
          <video
            src={bgVideo}
            autoPlay muted loop playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: (bg.type || 'cover') as React.CSSProperties['objectFit'] }}
          />
        ) : bgImage ? (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bgImage})`, backgroundSize: bg.type || 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#1e293b' }} />
        )}
        {bg.overlayOpacity > 0 && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: bg.overlayColor, opacity: bg.overlayOpacity }} />
        )}
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: bg.padding || '20px',
          minHeight: isPreview ? '100%' : '100vh',
          display: 'flex',
          flexDirection: 'column',
          filter: isOverlayActive ? 'blur(16px) brightness(0.45)' : 'none',
          pointerEvents: isOverlayActive ? 'none' : undefined,
          transition: 'filter 0.5s ease-out',
        }}
      >
        {config.elements
          .filter(el => el.enabled && el.type !== 'video_gate' && el.type !== 'announcement' && el.type !== 'attendance_gate')
          .map((el) => (
            <RenderElement key={el.id} element={el} params={params} isPreview={isPreview} redirectUrl={redirectUrl} campaignId={campaignId} isDesktop={isDesktop} autoPlayTrigger={el.type === 'video' ? autoPlayTrigger : 0} />
          ))}
      </div>

      {/* Video Gate overlay */}
      {showVideoGate && (
        <VideoGateRenderer el={videoGateEl} params={params} isPreview={isPreview} onDismissed={() => setVideoGateDismissed(true)} />
      )}

      {/* Attendance Gate overlay */}
      {showAttendanceGate && attendanceGateEl && (
        <AttendanceGateRenderer el={attendanceGateEl} params={params} campaignId={campaignId} redirectUrl={redirectUrl} onDismissed={() => setAttendanceGateDismissed(true)} />
      )}

      {/* Announcement overlay */}
      {showAnnouncement && (
        <AnnouncementRenderer el={announcementEl} params={params} />
      )}
    </div>
  );
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
}: {
  element: TemplateElement;
  params: Partial<PortalParams>;
  isPreview?: boolean;
  redirectUrl?: string;
  campaignId?: string;
  isDesktop?: boolean;
  autoPlayTrigger?: number;
  onSimulateConnect?: () => void;
}) {
  switch (element.type) {
    case 'logo': return <LogoRenderer el={element} />;
    case 'title': return <TitleRenderer el={element} />;
    case 'description': return <DescriptionRenderer el={element} />;
    case 'image': return <ImageRenderer el={element} isDesktop={isDesktop} />;
    case 'image_slider': return <ImageSliderRenderer el={element} isDesktop={isDesktop} />;
    case 'video': return <VideoRenderer el={element} isDesktop={isDesktop} autoPlayTrigger={autoPlayTrigger} />;
    case 'connect_button': return <ConnectButtonRenderer el={element} params={params} isPreview={isPreview} redirectUrl={redirectUrl} campaignId={campaignId} isDesktop={isDesktop} onSimulateConnect={onSimulateConnect} />;
    case 'spacer': return <SpacerRenderer el={element} isDesktop={isDesktop} />;
    case 'video_gate': return <VideoGateMockupRenderer el={element as VideoGateElement} isDesktop={isDesktop} />;
    case 'attendance_gate': return <AttendanceGateMockupRenderer el={element as AttendanceGateElement} isDesktop={isDesktop} />;
    case 'announcement': return <AnnouncementMockupRenderer el={element as AnnouncementElement} isDesktop={isDesktop} />;
    default: return null;
  }
}

function LogoRenderer({ el }: { el: LogoElement }) {
  if (!el.src) return null;
  const justify = el.position === 'left' ? 'flex-start' : el.position === 'right' ? 'flex-end' : 'center';
  return (
    <div style={{ display: 'flex', justifyContent: justify, padding: '12px 0' }}>
      <img src={el.src} alt="Logo" style={{ width: el.width, height: 'auto', objectFit: 'contain' }} />
    </div>
  );
}

function TitleRenderer({ el }: { el: TitleElement }) {
  const style: React.CSSProperties = { padding: '8px 0', textAlign: el.align, color: el.color, fontSize: el.fontSize, fontWeight: 700, margin: 0 };
  if (el.textShadow) style.textShadow = el.textShadow;
  if (el.textStroke) (style as Record<string, unknown>).WebkitTextStroke = `${el.textStroke} ${el.textStrokeColor || '#000'}`;
  return <h1 style={style}>{el.content}</h1>;
}

function DescriptionRenderer({ el }: { el: DescriptionElement }) {
  const style: React.CSSProperties = { padding: '4px 0', textAlign: 'center', color: el.color, fontSize: el.fontSize, margin: 0 };
  if (el.textShadow) style.textShadow = el.textShadow;
  if (el.textStroke) (style as Record<string, unknown>).WebkitTextStroke = `${el.textStroke} ${el.textStrokeColor || '#000'}`;
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

  // Shadow preset
  let shadowStyle = 'none';
  if (el.shadow === 'sm') shadowStyle = '0 2px 8px rgba(0,0,0,0.12)';
  else if (el.shadow === 'md') shadowStyle = '0 8px 20px -4px rgba(0,0,0,0.2)';
  else if (el.shadow === 'lg') shadowStyle = '0 16px 36px -6px rgba(0,0,0,0.3)';
  else if (el.shadow === 'glow') shadowStyle = '0 10px 30px -4px rgba(59,130,246,0.35)';

  // Border style
  let borderStyle = 'none';
  if (el.borderStyle === 'solid') {
    borderStyle = `${el.borderWidth || '2px'} solid ${el.borderColor || '#ffffff'}`;
  } else if (el.borderStyle === 'glass') {
    borderStyle = '1px solid rgba(255,255,255,0.35)';
  }

  return (
    <div style={{ padding: '4px 0', width: '100%' }}>
      <div
        style={{
          overflow: 'hidden',
          borderRadius: el.borderRadius || '12px',
          width: el.width || '100%',
          height: el.height === 'auto' ? 'auto' : el.height,
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
            height: el.height === 'auto' ? 'auto' : '100%',
            objectFit: el.objectFit || 'cover',
            objectPosition: `calc(50% + ${posX}px) calc(50% + ${posY}px)`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

function ImageSliderRenderer({ el, isDesktop }: { el: ImageSliderElement; isDesktop?: boolean }) {
  const [current, setCurrent] = useState(0);
  const images = isDesktop && el.imagesDesktop && el.imagesDesktop.length > 0 ? el.imagesDesktop : (el.images || []);
  const height = isDesktop && el.heightDesktop ? el.heightDesktop : (el.height || '220px');
  const touchStartX = useRef(0);

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

  return (
    <div style={{ padding: '4px 0', width: '100%' }}>
      <div
        className="group relative overflow-hidden shadow-lg"
        style={{
          borderRadius: el.borderRadius || '14px',
          height,
          position: 'relative',
          touchAction: 'pan-y',
          boxShadow: '0 12px 28px -6px rgba(0,0,0,0.25)',
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
              transition: 'opacity 0.6s ease-in-out',
              opacity: i === current ? 1 : 0,
              pointerEvents: i === current ? 'auto' : 'none',
            }}
          />
        ))}

        {/* Counter Badge */}
        {images.length > 1 && (
          <div className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono font-medium tracking-wider">
            {current + 1} / {images.length}
          </div>
        )}

        {/* Left / Right Navigation Controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
            >
              ›
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {images.length > 1 && (
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
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: i === current ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === current ? '#ffffff' : 'rgba(255,255,255,0.45)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
              />
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

  // Shadow preset
  let shadowStyle = '0 10px 25px -5px rgba(0,0,0,0.25)';
  if (el.shadow === 'sm') shadowStyle = '0 2px 8px rgba(0,0,0,0.15)';
  else if (el.shadow === 'md') shadowStyle = '0 8px 20px -4px rgba(0,0,0,0.25)';
  else if (el.shadow === 'lg') shadowStyle = '0 20px 40px -8px rgba(0,0,0,0.35)';
  else if (el.shadow === 'glow') shadowStyle = '0 10px 30px -4px rgba(59,130,246,0.4)';

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
          borderRadius: '14px',
          overflow: 'hidden',
          aspectRatio: aspectMap[el.aspectRatio || 'auto'] || 'auto',
          background: '#090d16',
          boxShadow: shadowStyle,
          border: '1px solid rgba(255,255,255,0.1)',
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
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
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
}: {
  el: ConnectButtonElement;
  params: Partial<PortalParams>;
  isPreview?: boolean;
  redirectUrl?: string;
  campaignId?: string;
  isDesktop?: boolean;
  onSimulateConnect?: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const buttonWidth = isDesktop ? (el.buttonWidthDesktop || el.buttonWidth || '100%') : (el.buttonWidth || '100%');

  const handleConnect = () => {
    if (onSimulateConnect) { onSimulateConnect(); return; }
    if (isPreview || submitting) return;

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
      if (phone) connectUrl.searchParams.set('phone', phone);
      if (trial) connectUrl.searchParams.set('trial', trial);
      if (linkLogin) connectUrl.searchParams.set('link-login', linkLogin);
      if (redirectUrl) connectUrl.searchParams.set('redirectUrl', redirectUrl);
      if (campaignId) connectUrl.searchParams.set('campaignId', campaignId);

      setSubmitted(true);
      window.location.href = connectUrl.toString();
    } catch (err) {
      console.error('Lỗi kết nối:', err);
      setErrorMessage('Không thể kết nối. Vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#22c55e' }}>✅ Đã kết nối thành công!</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>Đang chuyển hướng...</p>
      </div>
    );
  }

  // Button background & borders
  let buttonBg = el.bgColor || '#2563eb';
  let buttonBorder = 'none';
  let textColor = el.color || '#ffffff';

  if (el.buttonStyle === 'gradient') {
    buttonBg = el.gradient || `linear-gradient(135deg, ${el.bgColor || '#2563eb'} 0%, #4f46e5 100%)`;
  } else if (el.buttonStyle === 'glass') {
    buttonBg = 'rgba(255, 255, 255, 0.22)';
    buttonBorder = '1px solid rgba(255, 255, 255, 0.45)';
    textColor = el.color || '#ffffff';
  } else if (el.buttonStyle === 'outline') {
    buttonBg = 'transparent';
    buttonBorder = `2px solid ${el.bgColor || '#2563eb'}`;
    textColor = el.bgColor || '#2563eb';
  }

  // Shadow preset
  let buttonShadow = '0 6px 18px -2px rgba(37,99,235,0.3)';
  if (el.shadow === 'none') buttonShadow = 'none';
  else if (el.shadow === 'sm') buttonShadow = '0 2px 8px rgba(0,0,0,0.15)';
  else if (el.shadow === 'md') buttonShadow = '0 6px 18px -2px rgba(0,0,0,0.22)';
  else if (el.shadow === 'lg') buttonShadow = '0 12px 28px -4px rgba(0,0,0,0.35)';
  else if (el.shadow === 'glow') buttonShadow = `0 8px 24px -2px ${el.bgColor || '#2563eb'}70`;

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
        {el.imageSrc ? (
          <div style={{ width: '100%' }}>
            <img
              src={el.imageSrc}
              alt={el.text}
              onClick={handleConnect}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
              style={{
                width: isDesktop ? (el.imageWidthDesktop || el.imageWidth || '100%') : (el.imageWidth || '100%'),
                maxWidth: '100%',
                borderRadius: el.radius || '12px',
                cursor: 'pointer',
                display: 'block',
                opacity: submitting ? 0.6 : 1,
                margin: '0 auto',
                boxShadow: buttonShadow,
                transition: 'transform 0.15s ease',
              }}
            />
            <button
              onClick={handleConnect}
              disabled={submitting}
              style={{
                display: 'none',
                width: '100%',
                padding: '14px 20px',
                background: buttonBg,
                color: textColor,
                border: buttonBorder,
                borderRadius: el.radius || '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: buttonShadow,
              }}
            >
              {submitting ? 'Đang kết nối...' : el.text}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={submitting}
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              padding: '14px 20px',
              background: buttonBg,
              color: textColor,
              border: buttonBorder,
              borderRadius: el.radius || '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: submitting ? 0.6 : 1,
              boxShadow: buttonShadow,
              backdropFilter: el.buttonStyle === 'glass' ? 'blur(12px)' : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Shimmer light sweep */}
            {el.buttonEffect === 'shimmer' && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  transform: 'translateX(-100%)',
                  animation: 'shimmer 2.2s infinite',
                }}
              />
            )}
            {el.buttonIcon !== 'arrow' && renderIcon()}
            <span>{submitting ? 'Đang kết nối WiFi...' : el.text || 'Kết nối ngay'}</span>
            {el.buttonIcon === 'arrow' && renderIcon()}
          </button>
        )}

        {/* Terms of service disclaimer text */}
        {el.termsText && (
          <p
            style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.85)',
              textAlign: 'center',
              marginTop: '8px',
              lineHeight: 1.4,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            🔒 {el.termsText}
          </p>
        )}

        {errorMessage && (
          <p style={{ fontSize: '12px', color: '#fecaca', textAlign: 'center', marginTop: '8px' }}>
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export function VideoGateRenderer({ el, params, isPreview, forcedDesktop, onDismissed }: { el: VideoGateElement; params: Partial<PortalParams>; isPreview?: boolean; forcedDesktop?: boolean; onDismissed?: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(el.skipAfter || 5);
  const [canSkip, setCanSkip] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMuted, setIsMuted] = useState(el.muted ?? true);
  const [windowDesktop, setWindowDesktop] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isPreview && forcedDesktop === undefined) {
      const checkWidth = () => setWindowDesktop(window.innerWidth >= 768);
      checkWidth();
      window.addEventListener('resize', checkWidth);
      return () => window.removeEventListener('resize', checkWidth);
    }
  }, [isPreview, forcedDesktop]);

  const isDesktop = forcedDesktop !== undefined ? forcedDesktop : windowDesktop;
  const theme = getDialogThemeStyles(el.dialogTheme);
  const effectiveMaxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  const rawRatio = el.aspectRatio || '16:9';
  const effectiveRatio = (isDesktop && rawRatio === '9:16') ? '16:9' : rawRatio;
  const aspectMap: Record<string, string> = { '16:9': '16/9', '9:16': '9/16', '4:3': '4/3', 'auto': '16/9' };
  const isVertical = effectiveRatio === '9:16';

  useEffect(() => {
    if (secondsLeft <= 0) { setCanSkip(true); return; }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleSkip = useCallback(async () => {
    if (!isPreview) {
      try {
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await fetch('/api/video-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, mac: params.mac || '' }),
        });
      } catch {}
    }
    setDismissed(true);
    onDismissed?.();
  }, [isPreview, params.mac, onDismissed]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  if (dismissed) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 10, 20, 0.78)',
      backdropFilter: el.overlayBlur || 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      {/* Dialog card */}
      <div style={{
        background: theme.cardBg,
        borderRadius: el.borderRadius || '24px',
        overflow: 'hidden',
        width: '100%',
        maxWidth: effectiveMaxWidth,
        maxHeight: '94vh',
        boxShadow: theme.cardBoxShadow,
        border: theme.cardBorder,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Dialog header */}
        <div style={{ padding: isDesktop ? '20px 24px 14px' : '16px 18px 10px', textAlign: 'center' }}>
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
          <h2 style={{
            margin: 0,
            fontSize: isDesktop ? '21px' : '17px',
            fontWeight: 700,
            color: theme.titleColor,
            textShadow: theme.titleTextShadow,
            lineHeight: 1.3,
          }}>
            {el.dialogTitle || 'Xem video để kết nối WiFi'}
          </h2>
          <p style={{
            margin: '6px 0 0',
            fontSize: isDesktop ? '14px' : '12px',
            color: theme.messageColor,
            lineHeight: 1.45,
          }}>
            {el.dialogMessage || 'Vui lòng xem video ngắn trước khi truy cập WiFi tốc độ cao.'}
          </p>
        </div>

        {/* Video frame */}
        <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            width: '100%',
            aspectRatio: aspectMap[effectiveRatio] || '16/9',
            maxHeight: isVertical ? 'min(500px, 60vh)' : 'min(440px, 55vh)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
          }}>
            {el.videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={el.videoUrl}
                  autoPlay muted={isMuted} playsInline
                  poster={el.poster || undefined}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
                />
                <button
                  onClick={toggleMute}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '18px', zIndex: 5,
                    backdropFilter: 'blur(4px)',
                  }}
                  title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                >
                  {isMuted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  )}
                </button>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px' }}>📹</div>
                <p style={{ fontSize: '13px', margin: 0, color: '#cbd5e1' }}>Đang chờ video quảng cáo...</p>
              </div>
            )}
          </div>
        </div>

        {/* Dialog footer */}
        <div style={{ padding: isDesktop ? '18px 24px 22px' : '14px 18px 18px', textAlign: 'center' }}>
          {canSkip ? (
            <button
              onClick={handleSkip}
              style={{
                padding: '13px 32px',
                background: theme.buttonBg,
                color: theme.buttonColor,
                border: theme.buttonBorder,
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: isDesktop ? '15px' : '14px',
                cursor: 'pointer',
                width: '100%',
                boxShadow: theme.buttonShadow,
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
            >
              Tiếp tục kết nối WiFi →
            </button>
          ) : (
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                gap: '10px',
                padding: '10px 22px',
                background: theme.waitBadgeBg,
                border: theme.waitBadgeBorder,
                borderRadius: '12px',
                color: theme.waitBadgeText,
                fontSize: '13px',
                fontWeight: 600,
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: theme.waitCounterBg, color: theme.waitCounterText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 800,
                }}>
                  {secondsLeft}
                </div>
                <span>Đợi {secondsLeft}s để tiếp tục kết nối WiFi</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementRenderer({ el, params, isPreview, forcedDesktop, onDismissed }: { el: AnnouncementElement; params: Partial<PortalParams>; isPreview?: boolean; forcedDesktop?: boolean; onDismissed?: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(el.skipAfter || 5);
  const [canDismiss, setCanDismiss] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [windowDesktop, setWindowDesktop] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isPreview && forcedDesktop === undefined) {
      const checkWidth = () => setWindowDesktop(window.innerWidth >= 768);
      checkWidth();
      window.addEventListener('resize', checkWidth);
      return () => window.removeEventListener('resize', checkWidth);
    }
  }, [isPreview, forcedDesktop]);

  const isDesktop = forcedDesktop !== undefined ? forcedDesktop : windowDesktop;
  const theme = getDialogThemeStyles(el.dialogTheme);
  const effectiveMaxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  useEffect(() => {
    if (secondsLeft <= 0) { setCanDismiss(true); return; }
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Auto-start video when announcement renders
  useEffect(() => {
    if (!el.videoUrl) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  }, [el.videoUrl]);

  const handleDismiss = async () => {
    if (!canDismiss) return;
    try {
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await fetch('/api/video-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mac: params.mac || '', type: 'announcement' }),
      });
    } catch {}
    setDismissed(true);
    onDismissed?.();
  };

  if (dismissed) return null;

  const titleStyle: React.CSSProperties = {
    fontSize: el.titleFontSize || (isDesktop ? '21px' : '18px'),
    fontWeight: el.titleBold ? 700 : 600,
    fontStyle: el.titleItalic ? 'italic' : 'normal',
    color: el.titleColor || theme.titleColor,
    textShadow: theme.titleTextShadow,
    marginBottom: '10px',
    lineHeight: 1.3,
    display: 'block',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: el.messageFontSize || (isDesktop ? '14px' : '13px'),
    fontWeight: el.messageBold ? 600 : 400,
    fontStyle: el.messageItalic ? 'italic' : 'normal',
    color: el.messageColor || theme.messageColor,
    lineHeight: 1.6,
    marginBottom: '20px',
    display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 10, 20, 0.78)',
      backdropFilter: el.overlayBlur || 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: el.bgColor || theme.cardBg,
        borderRadius: el.borderRadius || '24px',
        overflow: 'hidden',
        width: '100%',
        maxWidth: effectiveMaxWidth,
        maxHeight: '94vh',
        boxShadow: theme.cardBoxShadow,
        border: theme.cardBorder,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {el.videoUrl && (
          <div style={{ aspectRatio: '16/9', maxHeight: 'min(440px, 50vh)', background: '#000', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              src={el.videoUrl}
              playsInline
              muted
              loop
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
            />
          </div>
        )}
        {!el.videoUrl && el.imageUrl && (
          <div style={{ width: '100%', maxHeight: 'min(300px, 40vh)', overflow: 'hidden' }}>
            <img src={el.imageUrl} alt={el.title} style={{ width: '100%', height: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: isDesktop ? '24px' : '18px 20px', textAlign: 'center' }}>
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
          <span style={titleStyle}>{el.title}</span>
          <span style={messageStyle}>{el.message}</span>
          {canDismiss ? (
            <button
              onClick={handleDismiss}
              style={{
                width: '100%', padding: '13px',
                background: el.buttonBgColor || theme.buttonBg,
                color: el.buttonTextColor || theme.buttonColor,
                border: theme.buttonBorder, borderRadius: '12px',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: theme.buttonShadow,
              }}
            >
              {el.buttonText || 'Tiếp tục'}
            </button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 22px', background: theme.waitBadgeBg, border: theme.waitBadgeBorder, color: theme.waitBadgeText, borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: theme.waitCounterBg, color: theme.waitCounterText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>{secondsLeft}</div>
              <span>Đợi {secondsLeft}s để đóng...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AttendanceGateRenderer({
  el,
  params,
  campaignId,
  redirectUrl,
  onDismissed,
}: {
  el: AttendanceGateElement;
  params: Partial<PortalParams>;
  campaignId?: string;
  redirectUrl?: string;
  onDismissed?: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [windowDesktop, setWindowDesktop] = useState(false);

  useEffect(() => {
    const checkWidth = () => setWindowDesktop(window.innerWidth >= 768);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const isDesktop = windowDesktop;
  const theme = getDialogThemeStyles(el.dialogTheme);
  const effectiveMaxWidth = getDialogMaxWidth(el.dialogSize, el.dialogMaxWidthDesktop, el.dialogMaxWidth, isDesktop);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Vui lòng nhập Họ và tên');
      return;
    }
    if (!department.trim()) {
      setError('Vui lòng nhập Phòng ban / Đơn vị');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/attendance/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          ssid: params.ssid,
          mac: params.mac,
          ip: params.ip,
          answers: {
            fullname: fullName.trim(),
            department: department.trim(),
          },
          trial: (params as any)?.trial,
          linkLogin: (params as any)?.['link-login'],
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess(true);
        setTimeout(() => {
          onDismissed?.();
        }, 3000);
      } else {
        setError(json.error || 'Điểm danh không thành công.');
      }
    } catch {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(5, 10, 20, 0.82)',
        backdropFilter: el.overlayBlur || 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          background: theme.cardBg,
          borderRadius: el.borderRadius || '24px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: effectiveMaxWidth,
          maxHeight: '94vh',
          boxShadow: theme.cardBoxShadow,
          border: theme.cardBorder,
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <div style={{ padding: isDesktop ? '24px 28px 12px' : '20px 20px 10px' }}>
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
              marginBottom: '10px',
            }}
          >
            <span>{theme.ornament} Điểm danh cuộc họp</span>
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: isDesktop ? '20px' : '17px',
              fontWeight: 700,
              color: theme.titleColor,
              textShadow: theme.titleTextShadow,
              lineHeight: 1.3,
            }}
          >
            {el.dialogTitle || 'Điểm danh cuộc họp'}
          </h2>

          <p
            style={{
              margin: '6px 0 0',
              fontSize: isDesktop ? '13px' : '12px',
              color: theme.messageColor,
              lineHeight: 1.45,
            }}
          >
            {el.dialogMessage || 'Vui lòng nhập thông tin để xác thực điểm danh và nhận quyền truy cập WiFi.'}
          </p>
        </div>

        {success ? (
          <div style={{ padding: '32px 24px', color: '#10b981' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: theme.titleColor }}>Điểm danh thành công!</h3>
            <p style={{ fontSize: '13px', color: theme.messageColor, marginTop: '4px' }}>
              {el.successMessage || 'Đang cấp quyền truy cập Internet...'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: isDesktop ? '12px 28px 24px' : '10px 20px 20px', textAlign: 'left' }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: theme.titleColor, marginBottom: '5px' }}>
                  {el.nameLabel || 'Họ và tên'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={el.namePlaceholder || 'VD: Nguyễn Văn A'}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: theme.isDark ? 'rgba(0,0,0,0.35)' : '#ffffff',
                    color: theme.isDark ? '#ffffff' : '#0f172a',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: theme.titleColor, marginBottom: '5px' }}>
                  {el.departmentLabel || 'Phòng ban / Đơn vị'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={el.departmentPlaceholder || 'VD: Ban Biên tập Chính trị'}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: theme.isDark ? 'rgba(0,0,0,0.35)' : '#ffffff',
                    color: theme.isDark ? '#ffffff' : '#0f172a',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 24px',
                background: theme.buttonBg,
                color: theme.buttonColor,
                border: theme.buttonBorder,
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: theme.buttonShadow,
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
            >
              {loading ? 'Đang xác nhận...' : el.buttonText || 'Xác nhận điểm danh & Kết nối'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
