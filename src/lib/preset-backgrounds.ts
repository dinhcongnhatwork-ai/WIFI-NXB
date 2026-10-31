import type { DeviceVariant } from './template-document';

const BACKGROUNDS = ['van-hoa-doc', 'xuat-ban-so', 'hoi-nghi', 'trien-lam', 'ly-luan'] as const;

/** Only bundled starter backgrounds are upgraded; uploaded/custom images retain their settings. */
export function presetBackground(image: string | undefined, device: DeviceVariant): string | undefined {
  if (!image) return undefined;
  const name = BACKGROUNDS.find(name => image === `/nxb-templates/${name}-bg.jpg`
    || image === `/nxb-templates/backgrounds/${name}-desktop.webp`
    || image === `/nxb-templates/backgrounds/${name}-portrait.webp`);
  return name ? `/nxb-templates/backgrounds/${name}-${device === 'desktop' ? 'desktop' : 'portrait'}.webp` : undefined;
}
