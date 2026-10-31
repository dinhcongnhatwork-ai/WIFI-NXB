export type AdminRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type Permission = 'read' | 'operate' | 'admin';
export const ROLE_LABELS: Record<AdminRole, string> = { ADMIN: 'Quản trị', OPERATOR: 'Vận hành', VIEWER: 'Giám sát' };
export function isAdminRole(value: unknown): value is AdminRole { return typeof value === 'string' && Object.hasOwn(ROLE_LABELS, value); }
export function hasPermission(role: unknown, permission: Permission): boolean {
  if (!isAdminRole(role)) return false;
  return ({ADMIN:3,OPERATOR:2,VIEWER:1}[role]) >= ({read:1,operate:2,admin:3}[permission]);
}
export function requiresAdminAction(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  const data = input as Record<string,unknown>;
  const tokens = [data.action, data.command, data.path, data.resource].filter(v=>typeof v==='string').join('/').toLowerCase();
  return /(^|[\s/_.:-])(reboot|restart|upgrade|firmware|forget|restore|reset-wifi|reset-configuration|delete-device|backup|export|execute|script)([\s/_.:-]|$)/.test(tokens);
}
