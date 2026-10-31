import { flowNode, GATE_SCREENS, type DesignVariant, type GateScreenId, type RenderMode, type ScreenId } from '@/lib/template-document';
import type { PortalParams } from '@/types';
import type { AttendanceSessionDto } from '@/types/attendance';

export interface AttendanceContext { session: AttendanceSessionDto; isAlreadyRegistered: boolean }
export type SimulationOutcome = 'success' | 'error' | 'wait';
export const MOCK_ATTENDANCE_SESSION: AttendanceSessionDto = {
  id:'preview-meeting', name:'Cuộc họp minh họa', unifiSite:'preview', ssid:'WiFi Demo', targetApMacs:[],
  formSchema:[{id:'fullname',label:'Họ và tên',type:'text',required:true},{id:'department',label:'Phòng ban / Đơn vị',type:'text',required:true}],
  nameFieldKey:'fullname',idFieldKey:'fullname',dialogTitle:'Điểm danh cuộc họp',confirmButtonText:'Xác nhận điểm danh',successMessage:'Điểm danh thành công.',
  warningThresholdMinutes:15,status:'ACTIVE',startTime:'2020-01-01T00:00:00Z',endTime:'2099-01-01T00:00:00Z',createdAt:'2020-01-01T00:00:00Z',updatedAt:'2020-01-01T00:00:00Z',
};
export function nextFlowScreen(design: DesignVariant, completed: GateScreenId[], attendance?: AttendanceContext): ScreenId {
  return GATE_SCREENS.find(screen => {
    const node = flowNode(design,screen);
    return node && !node.hidden && node.element.enabled && !completed.includes(screen) &&
      (screen !== 'attendance_gate' || (!!attendance && attendance.session.status === 'ACTIVE' && !attendance.isAlreadyRegistered));
  }) || 'portal';
}
/** The only gate API mutation boundary. Editing and simulation always resolve locally. */
export async function gateAction({screen,mode,params,portalSessionId,session,answers,request=fetch}: {
  screen:GateScreenId;mode:RenderMode;params:Partial<PortalParams>;portalSessionId?:string;session?:AttendanceSessionDto;
  answers?:Record<string,unknown>;request?:typeof fetch;
}): Promise<void> {
  if (mode !== 'live' || screen === 'announcement') return;
  if (!portalSessionId) throw new Error('Thiếu phiên kết nối. Vui lòng tải lại trang.');
  if (screen === 'attendance_gate' && !session) throw new Error('Không có cuộc họp đang hoạt động.');
  const response = await request(screen === 'video_gate' ? '/api/video-complete' : '/api/attendance/portal/submit', {
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(screen === 'video_gate' ? {portalSessionId,mac:params.mac || ''} : {
      portalSessionId,sessionId:session!.id,ssid:params.ssid || session!.ssid,apMac:params.apMac,mac:params.mac || '',ip:params.ip,answers:answers || {},
    }),
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error || 'Không thể hoàn tất. Vui lòng thử lại.');
}
