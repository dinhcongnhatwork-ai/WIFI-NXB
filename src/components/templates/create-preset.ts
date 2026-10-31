import { api } from '@/lib/api';
import { createPresetDocument, TEMPLATE_PRESETS } from '@/lib/template-presets';

/** Called only by an explicit selection; the catalogue itself has no writes. */
export async function createTemplateFromPreset(presetId: string, token: string, name?: string): Promise<string> {
  if (!token) throw new Error('Vui lòng đăng nhập để tạo mẫu.');
  const preset = TEMPLATE_PRESETS.find(item => item.id === presetId);
  if (!preset) throw new Error('Mẫu khởi đầu không tồn tại.');
  const result = await api.post<{ data: { id: string } }>('/api/templates', {
    name: name?.trim() || preset.name,
    layoutJson: createPresetDocument(preset.id),
    thumbnail: preset.thumbnail,
    status: 'draft',
  }, token);
  if (!result.data?.id) throw new Error('Máy chủ chưa trả về mã mẫu mới.');
  return result.data.id;
}
