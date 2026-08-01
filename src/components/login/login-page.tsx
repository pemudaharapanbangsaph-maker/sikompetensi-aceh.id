'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, KeyRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { LogoPancaCita } from '@/components/shared/logo-pancacita'

export function LoginPage() {
  const { login, loading } = useAuthStore()
  const rememberedUser = typeof window !== 'undefined' ? localStorage.getItem('bpsdm_remembered_user') : null
  const [username, setUsername] = useState(rememberedUser || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!rememberedUser)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi')
      return
    }
    try {
      if (remember) {
        localStorage.setItem('bpsdm_remembered_user', username)
      } else {
        localStorage.removeItem('bpsdm_remembered_user')
      }
      await login(username.trim(), password, remember)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    }
  }

  const fillDemo = (u: string) => {
    setUsername(u)
    setPassword('admin123')
    setInfo(`Kredensial demo ${u} / admin123 diisi. Klik "Masuk" untuk lanjut.`)
  }

  return (
    <div className="min-h-screen flex">
      {/* ===== Left side - Branding (Dark Forest Green) ===== */}
      <div className="login-bg hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
        {/* Logo Pancasila - Top Left */}
        <div className="flex items-center gap-3 text-white relative z-10">
          <LogoPancaCita size={56} className="flex-shrink-0 drop-shadow-md" />
          <div>
            <p className="text-lg font-bold leading-tight">SIKOMPETENSI ACEH</p>
            <p className="text-[10px] text-green-100 tracking-widest font-medium">CORPORATE UNIVERSITY</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="text-white max-w-md relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-sm font-bold text-[#D4AF37] tracking-widest uppercase mb-4"
          >
            Pemerintah Aceh
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl xl:text-5xl font-bold leading-tight mb-5"
          >
            Membangun ASN Aceh yang profesional dan berintegritas
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-green-100 text-base leading-relaxed"
          >
            Satu pintu untuk pelatihan, pengembangan kompetensi, dan sertifikasi aparatur di lingkungan Pemerintah Aceh.
          </motion.p>
        </div>

        {/* Open Book Illustration (decorative) */}
        <svg className="login-book" viewBox="0 0 360 280" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M180 60 C 140 40, 80 40, 30 55 L 30 220 C 80 205, 140 205, 180 225 L 180 60 Z" fill="white" />
          <path d="M180 60 C 220 40, 280 40, 330 55 L 330 220 C 280 205, 220 205, 180 225 L 180 60 Z" fill="white" />
          <line x1="180" y1="60" x2="180" y2="225" stroke="white" strokeWidth="2" />
          <path d="M50 80 L 160 75 M50 100 L 160 95 M50 120 L 160 115 M50 140 L 160 135 M50 160 L 160 155 M50 180 L 160 175" stroke="white" strokeWidth="1.5" opacity="0.6" />
          <path d="M200 80 L 310 75 M200 100 L 310 95 M200 120 L 310 115 M200 140 L 310 135 M200 160 L 310 155 M200 180 L 310 175" stroke="white" strokeWidth="1.5" opacity="0.6" />
        </svg>

        {/* Footer - Bottom Left */}
        <div className="text-white text-sm font-semibold relative z-10">
          Badan Pengembangan Sumber Daya Manusia Aceh
        </div>
      </div>

      {/* ===== Right side - Login Form (Light Cream) ===== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-[#FAFAFA]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile branding (only on small screens) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <LogoPancaCita size={64} className="mb-3 drop-shadow-md" />
            <h1 className="text-xl font-bold text-[#1B5E20] text-center">SIKOMPETENSI ACEH</h1>
            <p className="text-[10px] text-slate-500 tracking-widest text-center mt-1">CORPORATE UNIVERSITY</p>
          </div>

          {/* Form - flat, no card */}
          <div className="px-2">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Masuk</h2>
              <p className="text-sm text-slate-500 mt-1.5">Gunakan akun ASN Anda untuk melanjutkan.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-slate-700">Username atau Email</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username atau email"
                    className="pl-11 h-12 bg-white border-slate-300 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 rounded-lg text-sm"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-[#1B5E20] hover:text-[#2E7D32] hover:underline font-medium"
                    onClick={() => setInfo('Hubungi Super Admin untuk reset password.')}
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="pl-11 pr-11 h-12 bg-white border-slate-300 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 rounded-lg text-sm"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1B5E20] focus:ring-[#1B5E20]/20 cursor-pointer"
                />
                <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Ingat saya (7 hari)</Label>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Info */}
              {info && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold text-base rounded-lg shadow-sm transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Masuk'
                )}
              </Button>

              {/* Registration prompt */}
              <p className="text-center text-sm text-slate-500">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setInfo('Aktivasi akun ASN dilakukan oleh Admin Bidang. Hubungi BPSDM Aceh untuk pengajuan.')}
                  className="text-[#1B5E20] hover:text-[#2E7D32] font-semibold hover:underline"
                >
                  Aktivasi Akun ASN
                </button>
              </p>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Akun Demo (klik untuk isi)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { u: 'superadmin', label: 'Super Admin', color: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' },
                  { u: 'admin', label: 'Admin Bidang', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
                  { u: 'operator', label: 'Operator', color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' },
                ].map((d) => (
                  <button
                    key={d.u}
                    type="button"
                    onClick={() => fillDemo(d.u)}
                    className={`text-xs font-medium px-2 py-2 rounded-lg border transition-colors ${d.color}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">Password semua akun: admin123</p>
            </div>

            {/* System Notice */}
            <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                Sistem internal Pemerintah Aceh untuk aparatur sipil negara.
                Akses tidak sah dilarang. Butuh bantuan? Hubungi <span className="font-semibold text-[#1B5E20]">BPSDM Aceh</span>.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} BPSDM Provinsi Aceh — Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
          </p>
        </motion.div>
      </div>
    </div>
  )
}
