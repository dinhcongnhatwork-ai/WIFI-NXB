'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { useAuth } from './AuthProvider';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Wifi, BarChart3, Layers } from 'lucide-react';

const features = [
  {
    icon: Wifi,
    title: 'Quản lý Chiến dịch',
    desc: 'Theo dõi & quản lý các chiến dịch Wifi Marketing một cách hiệu quả',
  },
  {
    icon: BarChart3,
    title: 'Thống kê chi tiết',
    desc: 'Xem các báo cáo chi tiết về lượt truy cập, người dùng và doanh thu',
  },
  {
    icon: Layers,
    title: 'Tích hợp đa nền tảng',
    desc: 'Kết nối dễ dàng với các thiết bị Wifi từ nhiều nhà cung cấp',
  },
];

export default function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Đăng nhập thành công');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT PANEL - Blue brand panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#1e40af] relative overflow-hidden flex-col justify-between p-12">

        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute top-40 -right-10 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute bottom-0 left-10 w-40 h-40 bg-white/5 rounded-full" />

        {/* Top: Logo + Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="WiFi Marketing"
                fill
                className="object-contain p-1.5"
                priority
              />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">WiFi Marketing</span>
          </div>
          <p className="text-white/60 text-sm ml-1">Hệ thống quản lý Wifi Marketing thông minh</p>
        </motion.div>

        {/* Middle: Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6 relative z-10"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <f.icon className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base leading-tight">{f.title}</h3>
                <p className="text-white/50 text-sm mt-0.5 leading-snug">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom: Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="relative z-10 flex gap-8 pt-6 border-t border-white/10"
        >
          <div>
            <p className="text-2xl font-bold text-white">99.9%</p>
            <p className="text-white/40 text-xs mt-0.5">Uptime</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">24/7</p>
            <p className="text-white/40 text-xs mt-0.5">Hỗ trợ</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">50+</p>
            <p className="text-white/40 text-xs mt-0.5">Tích hợp</p>
          </div>
        </motion.div>
      </div>

      {/* RIGHT PANEL - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#1e40af] flex items-center justify-center">
              <Image src="/logo.png" alt="WiFi Marketing" fill className="object-contain p-1.5" priority />
            </div>
            <span className="text-xl font-bold text-slate-900">WiFi Marketing</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
          <p className="text-slate-500 mt-1 mb-8">Chào mừng bạn quay trở lại</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                placeholder="Nhập tên đăng nhập"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                placeholder="Nhập mật khẩu"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#1e40af] hover:bg-[#1e3a8a] disabled:bg-slate-400 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-8">
            WiFi Marketing Platform v1.0
          </p>
        </motion.div>
      </div>
    </div>
  );
}
