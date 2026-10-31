import { describe, expect, it, vi } from 'vitest';
import { createDocument } from '../src/lib/template-document';
import { nextFlowScreen, gateAction, MOCK_ATTENDANCE_SESSION } from '../src/components/renderer/flow-runtime';

describe('flow progression and mutation isolation', () => {
  it('orders video, eligible attendance, announcement, portal and skips registered or absent meetings', () => {
    const variant = createDocument().variants.mobile;
    Object.values(variant.flow).forEach(n => { if (n) n.element.enabled = true; });
    const meeting = {session:MOCK_ATTENDANCE_SESSION, isAlreadyRegistered:false};
    expect(nextFlowScreen(variant, [], meeting)).toBe('video_gate');
    expect(nextFlowScreen(variant, ['video_gate'], meeting)).toBe('attendance_gate');
    expect(nextFlowScreen(variant, ['video_gate','attendance_gate'], meeting)).toBe('announcement');
    expect(nextFlowScreen(variant, ['video_gate','attendance_gate','announcement'], meeting)).toBe('portal');
    expect(nextFlowScreen(variant, ['video_gate'], {...meeting,isAlreadyRegistered:true})).toBe('announcement');
    expect(nextFlowScreen(variant, ['video_gate'])).toBe('announcement');
    expect(nextFlowScreen(variant, ['video_gate'], {...meeting,session:{...meeting.session,status:'ENDED'}})).toBe('announcement');
  });
  it.each(['edit','simulate'] as const)('never performs API mutations in %s mode', async mode => {
    const request = vi.fn();
    for (const screen of ['video_gate','attendance_gate','announcement'] as const) {
      await gateAction({screen,mode,params:{mac:'aa'},portalSessionId:'stable',session:MOCK_ATTENDANCE_SESSION,answers:{name:'A'},request});
    }
    expect(request).not.toHaveBeenCalled();
  });
  it('sends the stable session identifier for video and full meeting/network context for attendance', async () => {
    const payloads: unknown[] = [];
    const request = vi.fn(async (_url:RequestInfo|URL, init?:RequestInit) => {payloads.push(JSON.parse(String(init?.body)));return {ok:true,json:async()=>({success:true})} as Response;});
    await gateAction({screen:'video_gate',mode:'live',params:{mac:'aa'},portalSessionId:'stable',request});
    await gateAction({screen:'attendance_gate',mode:'live',params:{mac:'aa',ssid:'network',apMac:'ap'} as any,portalSessionId:'stable',session:MOCK_ATTENDANCE_SESSION,answers:{name:'A'},request});
    expect(payloads[0]).toEqual({mac:'aa',portalSessionId:'stable'});
    expect(payloads[1]).toMatchObject({sessionId:MOCK_ATTENDANCE_SESSION.id,portalSessionId:'stable',ssid:'network',apMac:'ap',mac:'aa',answers:{name:'A'}});
  });
  it('announcement never records video completion, including live mode', async () => {
    const request = vi.fn(); await gateAction({screen:'announcement',mode:'live',params:{},request});
    expect(request).not.toHaveBeenCalled();
  });
  it('keeps a failed API action from advancing the gate', async () => {
    await expect(gateAction({screen:'video_gate',mode:'live',params:{},portalSessionId:'stable',request:async()=>({ok:false,json:async()=>({error:'Denied'})}) as Response})).rejects.toThrow('Denied');
  });
});
