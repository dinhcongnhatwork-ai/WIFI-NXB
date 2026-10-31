import { describe, expect, it } from 'vitest';
import { positionCampaignMenu } from '@/components/campaigns/menu-position';

describe('campaign action menu placement', () => {
  it('opens above a low trigger and aligns using the measured menu width', () => {
    expect(positionCampaignMenu(
      { top: 500, bottom: 528, right: 1260 }, { width: 192, height: 400 },
      { left: 0, top: 0, width: 1280, height: 600 },
    )).toEqual({ top: 96, left: 1068, maxHeight: 488, maxWidth: 1264 });
  });

  it('opens below when there is enough room', () => {
    expect(positionCampaignMenu(
      { top: 100, bottom: 128, right: 500 }, { width: 192, height: 400 },
      { left: 0, top: 0, width: 1280, height: 800 },
    )).toEqual({ top: 132, left: 308, maxHeight: 660, maxWidth: 1264 });
  });

  it('bounds a tall menu to the larger available side for internal scrolling', () => {
    expect(positionCampaignMenu(
      { top: 160, bottom: 188, right: 550 }, { width: 192, height: 440 },
      { left: 0, top: 0, width: 560, height: 320 },
    )).toEqual({ top: 8, left: 358, maxHeight: 148, maxWidth: 544 });
  });

  it('clamps both horizontal edges including a viewport narrower than the menu', () => {
    expect(positionCampaignMenu(
      { top: 10, bottom: 30, right: 10 }, { width: 192, height: 40 },
      { left: 0, top: 0, width: 160, height: 100 },
    )).toEqual({ top: 34, left: 8, maxHeight: 58, maxWidth: 144 });
  });

  it('uses the visible viewport offsets when zoomed or above a virtual keyboard', () => {
    expect(positionCampaignMenu(
      { top: 300, bottom: 328, right: 550 }, { width: 192, height: 200 },
      { left: 50, top: 100, width: 400, height: 400 },
    )).toEqual({ top: 108, left: 250, maxHeight: 188, maxWidth: 384 });
  });
});
