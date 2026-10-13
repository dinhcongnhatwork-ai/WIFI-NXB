'use client';

import React, { useState } from 'react';
import {
  FormFieldDefinition,
  FormFieldType,
} from '@/types/attendance';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings2,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Hash,
  Type,
  Phone,
  Mail,
  List,
  Calendar,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

interface Props {
  fields: FormFieldDefinition[];
  onChange: (fields: FormFieldDefinition[]) => void;
  dialogTitle: string;
  onDialogTitleChange: (title: string) => void;
  dialogDescription: string;
  onDialogDescriptionChange: (desc: string) => void;
  confirmButtonText: string;
  onConfirmButtonTextChange: (txt: string) => void;
  successMessage: string;
  onSuccessMessageChange: (msg: string) => void;
}

const FIELD_TYPE_OPTIONS: Array<{
  type: FormFieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { type: 'text', label: 'Văn bản ngắn (Text)', icon: Type },
  { type: 'textarea', label: 'Đoạn văn (Textarea)', icon: Type },
  { type: 'number', label: 'Số (Number)', icon: Hash },
  { type: 'phone', label: 'Số điện thoại (Phone)', icon: Phone },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'select', label: 'Danh sách chọn (Select)', icon: List },
  { type: 'radio', label: 'Nút chọn đơn (Radio)', icon: CheckSquare },
  { type: 'checkbox', label: 'Hộp kiểm (Checkbox)', icon: CheckSquare },
  { type: 'date', label: 'Ngày tháng (Date)', icon: Calendar },
];

export default function AttendanceFormBuilder({
  fields,
  onChange,
  dialogTitle,
  onDialogTitleChange,
  dialogDescription,
  onDialogDescriptionChange,
  confirmButtonText,
  onConfirmButtonTextChange,
  successMessage,
  onSuccessMessageChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);

  const addField = (type: FormFieldType = 'text') => {
    const id = `field_${Date.now()}`;
    const newField: FormFieldDefinition = {
      id,
      type,
      label: `Trường mới ${fields.length + 1}`,
      placeholder: 'Nhập thông tin...',
      required: false,
      isDisplayName: false,
      isIdentifier: false,
    };
    onChange([...fields, newField]);
    setExpandedFieldId(id);
  };

  const removeField = (id: string) => {
    const target = fields.find((f) => f.id === id);
    if (target?.isDisplayName || target?.isIdentifier) {
      alert('Không thể xóa trường được chỉ định làm Tên hiển thị hoặc Mã định danh. Vui lòng chuyển vai trò sang trường khác trước.');
      return;
    }
    onChange(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, patch: Partial<FormFieldDefinition>) => {
    onChange(
      fields.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, ...patch };

        // If making this field the Display Name, unset others
        if (patch.isDisplayName) {
          updated.required = true; // Display name must be required
        }
        // If making this field Identifier, unset others
        if (patch.isIdentifier) {
          updated.required = true; // Identifier must be required
        }
        return updated;
      }).map((f) => {
        if (patch.isDisplayName && f.id !== id) return { ...f, isDisplayName: false };
        if (patch.isIdentifier && f.id !== id) return { ...f, isIdentifier: false };
        return f;
      })
    );
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const copy = [...fields];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    onChange(copy);
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'editor'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Thiết kế biểu mẫu ({fields.length} trường)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Xem thử trực quan (Live Preview)
          </button>
        </div>

        {activeTab === 'preview' && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                previewDevice === 'mobile'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                previewDevice === 'desktop'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
          </div>
        )}
      </div>

      {activeTab === 'editor' ? (
        <div className="space-y-6">
          {/* Dialog General Settings */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-blue-600" />
              Cài đặt tiêu đề & Lời nhắn Dialog
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề Dialog</label>
                <input
                  type="text"
                  value={dialogTitle}
                  onChange={(e) => onDialogTitleChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Điểm danh cuộc họp"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Văn bản nút xác nhận</label>
                <input
                  type="text"
                  value={confirmButtonText}
                  onChange={(e) => onConfirmButtonTextChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Xác nhận điểm danh và kết nối"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Lời giới thiệu / Ghi chú</label>
                <input
                  type="text"
                  value={dialogDescription}
                  onChange={(e) => onDialogDescriptionChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Vui lòng điền thông tin để xác thực điểm danh và nhận quyền truy cập WiFi."
                />
              </div>
            </div>
          </div>

          {/* Fields List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Danh sách các trường biểu mẫu:</span>
              <span className="text-[11px] text-slate-400">
                Kéo hoặc bấm nút mũi tên để đổi thứ tự hiển thị
              </span>
            </div>

            {fields.map((field, idx) => {
              const isExpanded = expandedFieldId === field.id;
              return (
                <div
                  key={field.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? 'border-blue-300 bg-blue-50/20 shadow-md ring-1 ring-blue-400/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Field Header */}
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                    >
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">{field.label}</p>
                          {field.required && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                              Bắt buộc
                            </span>
                          )}
                          {field.isDisplayName && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              Tên hiển thị
                            </span>
                          )}
                          {field.isIdentifier && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Hash className="w-2.5 h-2.5" />
                              Mã định danh duy nhất
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 capitalize">
                          Kiểu: {field.type} • ID: {field.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, 'down')}
                        disabled={idx === fields.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                        title="Xóa trường"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Field Editor */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/60 rounded-b-2xl">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nhãn hiển thị (Label)</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Kiểu trường dữ liệu</label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(field.id, { type: e.target.value as FormFieldType })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.type} value={opt.type}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Gợi ý nhập (Placeholder)</label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      {/* Options for select / radio */}
                      {['select', 'radio', 'checkbox'].includes(field.type) && (
                        <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Các tùy chọn (phân tách bằng dấu phẩy)
                          </label>
                          <input
                            type="text"
                            value={(field.options || []).join(', ')}
                            onChange={(e) =>
                              updateField(field.id, {
                                options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                              })
                            }
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Lựa chọn 1, Lựa chọn 2, Lựa chọn 3"
                          />
                        </div>
                      )}

                      {/* Role selection flags */}
                      <div className="md:col-span-3 flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            disabled={field.isDisplayName || field.isIdentifier}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          Bắt buộc điền
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                          <input
                            type="checkbox"
                            checked={Boolean(field.isDisplayName)}
                            onChange={(e) => updateField(field.id, { isDisplayName: e.target.checked })}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          Dùng làm &ldquo;Tên hiển thị&rdquo;
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          <input
                            type="checkbox"
                            checked={Boolean(field.isIdentifier)}
                            onChange={(e) => updateField(field.id, { isIdentifier: e.target.checked })}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          Dùng làm &ldquo;Mã định danh duy nhất&rdquo;
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Field Button */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-bold text-slate-500 mr-2">Thêm trường mới:</span>
            {FIELD_TYPE_OPTIONS.slice(0, 5).map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => addField(opt.type)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
              >
                <opt.icon className="w-3.5 h-3.5 text-blue-500" />
                + {opt.label.split(' ')[0]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addField('select')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
            >
              <List className="w-3.5 h-3.5 text-blue-500" />
              + Danh sách chọn
            </button>
          </div>
        </div>
      ) : (
        /* LIVE PREVIEW TAB */
        <div className="flex justify-center p-6 bg-slate-900/5 rounded-3xl border border-slate-200">
          <div
            className={`transition-all duration-300 ${
              previewDevice === 'mobile'
                ? 'w-[360px] rounded-[2.5rem] p-3.5 bg-slate-900 shadow-2xl ring-1 ring-slate-800'
                : 'w-[640px] rounded-2xl p-4 bg-white border border-slate-200 shadow-xl'
            }`}
          >
            {/* Phone Speaker Notch */}
            {previewDevice === 'mobile' && (
              <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-3" />
            )}

            <div className="rounded-2xl bg-white p-6 space-y-4 text-slate-800 shadow-sm border border-slate-100">
              <div className="text-center pb-2 border-b border-slate-100">
                <span className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  WiFi Hội nghị
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1.5">{dialogTitle}</h3>
                {dialogDescription && (
                  <p className="text-xs text-slate-500 mt-1">{dialogDescription}</p>
                )}
              </div>

              {/* Sample Rendered Form */}
              <div className="space-y-3">
                {fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {field.label} {field.required && <span className="text-rose-500">*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 outline-none"
                        disabled
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 outline-none"
                        disabled
                      >
                        <option value="">-- Chọn {field.label} --</option>
                        {(field.options || ['Lựa chọn 1', 'Lựa chọn 2']).map((opt, i) => (
                          <option key={i}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'phone' ? 'tel' : 'text'}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 outline-none"
                        disabled
                      />
                    )}
                  </div>
                ))}

                {/* Device Verified Note */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Thiết bị đã kết nối: <strong>iPhone (AA:BB:CC:11:22:33)</strong></span>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.98] transition-transform"
                >
                  {confirmButtonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
