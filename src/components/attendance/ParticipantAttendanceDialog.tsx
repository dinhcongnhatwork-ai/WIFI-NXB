'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FormFieldDefinition,
  AttendanceSessionDto,
} from '@/types/attendance';
import type { AttendanceGateElement } from '@/types';
import { getDialogThemeStyles } from '@/components/renderer/PortalRenderer';
import {
  Wifi,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Smartphone,
  X,
  Clock,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  session: AttendanceSessionDto;
  clientMac: string;
  clientIp?: string;
  ssid?: string;
  trialUrl?: string;
  linkLoginUrl?: string;
  linkLoginOnly?: string;
  campaignId?: string;
  theme?: 'luxury_gold' | 'cinematic_dark' | 'glass_neon' | 'clean_light';
  gateElement?: AttendanceGateElement | null;
}

export default function ParticipantAttendanceDialog({
  isOpen,
  onClose,
  onSuccess,
  session,
  clientMac,
  clientIp,
  ssid,
  trialUrl,
  linkLoginUrl,
  linkLoginOnly,
  campaignId,
  theme = 'luxury_gold',
  gateElement,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; redirectUrl: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const effectiveTheme = theme || gateElement?.dialogTheme || 'luxury_gold';
  const themeStyles = getDialogThemeStyles(effectiveTheme);

  // 3-second countdown after submission: auto-close dialog and let user click "Kết nối ngay"
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onSuccess?.();
      onClose();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, onClose, onSuccess]);

  if (!isOpen) return null;

  const defaultFields: FormFieldDefinition[] = [
    {
      id: 'fullname',
      label: gateElement?.nameLabel || 'Họ và tên',
      type: 'text',
      required: true,
      placeholder: gateElement?.namePlaceholder || 'VD: Nguyễn Văn A',
    },
    {
      id: 'department',
      label: gateElement?.departmentLabel || 'Phòng ban / Đơn vị',
      type: 'text',
      required: true,
      placeholder: gateElement?.departmentPlaceholder || 'VD: Ban Biên tập Chính trị',
    },
  ];

  const rawFields = (session.formSchema as FormFieldDefinition[]) || [];
  const formFields = rawFields.length > 0 ? rawFields : defaultFields;

  const handleInputChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
    setErrorMessage(null);
  };

  const handleCloseDialog = () => {
    if (successInfo) {
      onSuccess?.();
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validation
    const errors: Record<string, string> = {};
    for (const f of formFields) {
      const val = answers[f.id];
      if (f.required && (val === undefined || val === null || String(val).trim() === '')) {
        errors[f.id] = `Vui lòng điền ${f.label}`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/attendance/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          campaignId,
          ssid: ssid || session.ssid,
          mac: clientMac,
          ip: clientIp,
          answers,
          trial: trialUrl,
          linkLogin: linkLoginUrl,
          linkLoginOnly: linkLoginOnly,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const connectUrl = json.data?.redirectConnectUrl || '';
        setSuccessInfo({
          message: json.data?.message || session.successMessage || 'Điểm danh thành công! Đang xác thực...',
          redirectUrl: connectUrl,
        });

        // Do NOT redirect immediately.
        // Start 3-second countdown: "Hệ thống đang xác thực..." -> close dialog -> user clicks "Kết nối ngay"
        setCountdown(3);
      } else {
        setErrorMessage(json.error || 'Có lỗi xảy ra khi gửi biểu mẫu.');
        if (json.fieldErrors) {
          setFieldErrors(json.fieldErrors);
        }
      }
    } catch {
      setErrorMessage('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = themeStyles.isDark;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          onClick={handleCloseDialog}
        />

        {/* Double-Bezel Modal Container styled according to theme */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{
            maxWidth: '520px',
            borderRadius: gateElement?.borderRadius || '28px',
            background: isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)',
            boxShadow: themeStyles.cardBoxShadow,
          }}
          className="relative w-full p-2 ring-1 ring-white/10 z-10 my-auto"
        >
          <div
            style={{
              background: themeStyles.cardBg,
              border: themeStyles.cardBorder,
              borderRadius: gateElement?.borderRadius ? `calc(${gateElement.borderRadius} - 4px)` : '24px',
            }}
            className="p-6 sm:p-8 space-y-6 shadow-2xl relative"
          >
            {/* Header */}
            <div className="text-center relative">
              {/* Badge */}
              <div
                style={{
                  background: themeStyles.headerBadgeBg,
                  border: themeStyles.headerBadgeBorder,
                  color: themeStyles.headerBadgeText,
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] uppercase font-bold tracking-[0.12em] mb-2 shadow-sm"
              >
                <span>{themeStyles.ornament}</span>
                <span>{session.location || session.name || 'Điểm danh cuộc họp'}</span>
              </div>

              {/* Title */}
              <h2
                style={{
                  color: themeStyles.titleColor,
                  textShadow: themeStyles.titleTextShadow,
                }}
                className="text-xl sm:text-2xl font-black tracking-tight"
              >
                {session.dialogTitle || gateElement?.dialogTitle || 'Điểm danh cuộc họp'}
              </h2>

              {/* Description */}
              <p
                style={{ color: themeStyles.messageColor }}
                className="text-xs mt-1.5 max-w-sm mx-auto leading-relaxed"
              >
                {session.dialogDescription ||
                  gateElement?.dialogMessage ||
                  'Vui lòng nhập Họ tên và Phòng ban để hoàn tất điểm danh và nhận quyền truy cập WiFi.'}
              </p>

              {/* Verified MAC context pill */}
              <div
                style={{
                  background: isDark ? 'rgba(0, 0, 0, 0.45)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                }}
                className="mt-3.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-medium"
              >
                <Smartphone className={`w-3.5 h-3.5 ${effectiveTheme === 'luxury_gold' ? 'text-amber-400' : 'text-blue-500'}`} />
                <span>Thiết bị: <strong className="font-mono" style={{ color: themeStyles.titleColor }}>{clientMac || 'WiFi'}</strong></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-300">Không thể điểm danh</p>
                  <p className="mt-0.5 text-rose-200">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Success View with 3s Countdown */}
            {successInfo ? (
              <div className="py-6 text-center space-y-4">
                <div
                  style={{
                    background: effectiveTheme === 'luxury_gold'
                      ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(212, 175, 55, 0.3))'
                      : isDark
                        ? 'rgba(16, 185, 129, 0.2)'
                        : '#ecfdf5',
                    border: effectiveTheme === 'luxury_gold'
                      ? '1.5px solid rgba(234, 179, 8, 0.6)'
                      : '1px solid rgba(16, 185, 129, 0.5)',
                    color: effectiveTheme === 'luxury_gold' ? '#fde047' : '#10b981',
                  }}
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3
                    style={{ color: themeStyles.titleColor, textShadow: themeStyles.titleTextShadow }}
                    className="text-lg font-black"
                  >
                    Điểm danh thành công!
                  </h3>
                  <p
                    style={{ color: themeStyles.messageColor }}
                    className="text-xs max-w-xs mx-auto leading-relaxed"
                  >
                    {successInfo.message}
                  </p>
                </div>

                {/* 3s Countdown pill */}
                <div
                  style={{
                    background: themeStyles.headerBadgeBg,
                    border: themeStyles.headerBadgeBorder,
                    color: themeStyles.headerBadgeText,
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wide shadow-sm"
                >
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>
                    Hệ thống đang xác thực... Tự động đóng sau <strong className="text-sm font-black underline decoration-amber-400">{countdown}s</strong>
                  </span>
                </div>

                <p
                  style={{ color: themeStyles.messageColor }}
                  className="text-[11px] opacity-85 max-w-xs mx-auto"
                >
                  Sau khi hộp thoại đóng, vui lòng nhấn <strong>"Kết nối ngay"</strong> trên màn hình để truy cập mạng WiFi.
                </p>

                {/* Action to proceed immediately */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    style={{
                      background: themeStyles.buttonBg,
                      color: themeStyles.buttonColor,
                      border: themeStyles.buttonBorder,
                      boxShadow: themeStyles.buttonShadow,
                    }}
                    className="w-full py-3 px-6 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <span>Tiếp tục ngay (hoặc đợi {countdown}s)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {formFields.map((field) => {
                  const hasError = Boolean(fieldErrors[field.id]);
                  return (
                    <div key={field.id} className="space-y-1 text-left">
                      <label
                        style={{
                          color: effectiveTheme === 'luxury_gold' ? '#fde047' : isDark ? '#f1f5f9' : '#334155',
                        }}
                        className="block text-xs font-bold"
                      >
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={answers[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
                            border: hasError
                              ? '1.5px solid #f43f5e'
                              : isDark
                                ? '1px solid rgba(255, 255, 255, 0.18)'
                                : '1px solid #cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          }}
                          className="w-full px-3.5 py-2 rounded-xl text-xs focus:outline-none transition-all placeholder:text-slate-400"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={answers[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          style={{
                            background: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff',
                            border: hasError
                              ? '1.5px solid #f43f5e'
                              : isDark
                                ? '1px solid rgba(255, 255, 255, 0.18)'
                                : '1px solid #cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all"
                        >
                          <option value="" className="text-slate-900">-- Chọn {field.label} --</option>
                          {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt} className="text-slate-900">
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            field.type === 'number'
                              ? 'number'
                              : field.type === 'phone'
                                ? 'tel'
                                : field.type === 'email'
                                  ? 'email'
                                  : field.type === 'date'
                                    ? 'date'
                                    : 'text'
                          }
                          value={answers[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          style={{
                            background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
                            border: hasError
                              ? '1.5px solid #f43f5e'
                              : isDark
                                ? (effectiveTheme === 'luxury_gold' ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid rgba(255, 255, 255, 0.18)')
                                : '1px solid #cbd5e1',
                            color: isDark ? '#ffffff' : '#0f172a',
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs focus:outline-none transition-all placeholder:text-slate-400"
                        />
                      )}

                      {hasError && (
                        <p className="text-[11px] text-rose-400 font-medium">{fieldErrors[field.id]}</p>
                      )}
                    </div>
                  );
                })}

                {/* Submit Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: themeStyles.buttonBg,
                      color: themeStyles.buttonColor,
                      border: themeStyles.buttonBorder,
                      boxShadow: themeStyles.buttonShadow,
                    }}
                    className="group relative w-full rounded-full font-black text-xs py-3 px-6 flex items-center justify-between transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? 'Đang xác nhận dữ liệu...'
                        : session.confirmButtonText || gateElement?.buttonText || 'Xác nhận điểm danh & Kết nối'}
                    </span>
                    <span
                      style={{
                        background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.25)',
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:scale-105"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
