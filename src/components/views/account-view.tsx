'use client'

import { useState, useEffect } from 'react'
import { useAuthStore, useNavStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Shield, ShieldCheck, ShieldOff, User, Mail, Phone, Clock, Loader2,
  Copy, CheckCircle2, AlertCircle, QrCode, Key, Smartphone, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export function AccountView() {
  const { activeView } = useNavStore()
  const isKeamanan = activeView === 'account-keamanan'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isKeamanan ? <KeamananSection /> : <ProfilSection />}
    </div>
  )
}

function ProfilSection() {
  const { user } = useAuthStore()
  if (!user) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#0F4C81]" />
            Informasi Akun
          </CardTitle>
          <CardDescription>Detail akun yang sedang digunakan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Nama Lengkap</Label>
              <p className="text-sm font-medium text-slate-900">{user.nama}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Username</Label>
              <p className="text-sm font-medium text-slate-900">{user.username}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Email</Label>
              <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Role</Label>
              <Badge className={user.role === 'SUPER_ADMIN' ? 'bg-[#195737] text-white' : 'bg-slate-100 text-slate-700'}>
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'ADMIN_BIDANG' ? 'Admin Bidang' : 'Operator'}
              </Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <Badge className="bg-green-100 text-green-700">Aktif</Badge>
            </div>
            {user.lastLogin && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Terakhir Login</Label>
                <p className="text-sm text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(user.lastLogin).toLocaleString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

type SetupStep = 'idle' | 'qr' | 'verify' | 'done'
type DisableStep = 'idle' | 'confirm'

function KeamananSection() {
  const { user } = useAuthStore()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState<SetupStep>('idle')
  const [disableStep, setDisableStep] = useState<DisableStep>('idle')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', ''])
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableError, setDisableError] = useState('')

  useEffect(() => {
    fetch('/api/2fa/status', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { setEnabled(d.enabled); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleStartSetup = async () => {
    setSetupLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/2fa/setup', { method: 'POST', credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) { setSetupError(data.error || 'Gagal'); return }
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setSetupStep('qr')
    } catch {
      setSetupError('Terjadi kesalahan jaringan')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = verifyCode.join('')
    if (code.length !== 6) return
    setSetupLoading(true)
    setSetupError('')
    try {
      const res = await fetch('/api/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { setSetupError(data.error || 'Kode tidak valid'); return }
      setSetupStep('done')
      setEnabled(true)
      toast.success('2FA berhasil diaktifkan!')
    } catch {
      setSetupError('Terjadi kesalahan jaringan')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disableCode || disableCode.length !== 6) {
      setDisableError('Masukkan kode 6 digit')
      return
    }
    setDisableLoading(true)
    setDisableError('')
    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentCode: disableCode }),
      })
      const data = await res.json()
      if (!res.ok) { setDisableError(data.error || 'Gagal menonaktifkan'); return }
      setEnabled(false)
      setDisableStep('idle')
      setDisableCode('')
      toast.success('2FA berhasil dinonaktifkan')
    } catch {
      setDisableError('Terjadi kesalahan jaringan')
    } finally {
      setDisableLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret key berhasil disalin')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F4C81]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0F4C81]" />
            Autentikasi Dua Faktor (2FA)
          </CardTitle>
          <CardDescription>
            Tambahkan lapisan keamanan ekstra saat login menggunakan Google Authenticator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
            enabled ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'
          }`}>
            {enabled ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">2FA Aktif</p>
                  <p className="text-xs text-green-600">Akun Anda dilindungi dengan autentikasi dua faktor</p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200">Aktif</Badge>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <ShieldOff className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">2FA Tidak Aktif</p>
                  <p className="text-xs text-slate-500">Aktifkan untuk keamanan akun yang lebih baik</p>
                </div>
                <Badge className="bg-slate-100 text-slate-500 border-slate-200">Nonaktif</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {!enabled && setupStep === 'idle' && disableStep === 'idle' && (
          <motion.div key="activate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#195737]" />
                  Aktivasi 2FA
                </CardTitle>
                <CardDescription>
                  Anda akan memindai QR Code menggunakan aplikasi Google Authenticator di HP Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <h4 className="text-sm font-semibold text-amber-800 mb-2">Sebelum memulai:</h4>
                    <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                      <li>Pastikan aplikasi <strong>Google Authenticator</strong> sudah terinstall di HP Anda</li>
                      <li>Siapkan HP Anda untuk memindai QR Code</li>
                      <li>Setelah QR Code dipindai, masukkan kode 6 digit untuk konfirmasi</li>
                    </ol>
                  </div>
                  <Button onClick={handleStartSetup} disabled={setupLoading} className="w-full bg-[#195737] hover:bg-[#0F4227]">
                    {setupLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : <><QrCode className="w-4 h-4 mr-2" /> Mulai Aktivasi</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!enabled && setupStep === 'qr' && (
          <motion.div key="qr-step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-[#195737]" />
                  Scan QR Code
                </CardTitle>
                <CardDescription>
                  Buka Google Authenticator di HP, tap <strong>"+"</strong> → <strong>"Scan QR Code"</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                    {qrCode && <img src={qrCode} alt="QR Code 2FA" className="w-64 h-64" />}
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> Atau masukkan manual (Setup Key)
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 select-all break-all">
                      {secret}
                    </code>
                    <Button variant="outline" size="icon" onClick={copySecret} className="flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Di Google Authenticator: tap <strong>"+"</strong> → <strong>"Enter setup key"</strong> → masukkan kode di atas
                  </p>
                </div>
                {setupError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{setupError}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSetupStep('idle')} className="flex-1">Batal</Button>
                  <Button onClick={() => setSetupStep('verify')} className="flex-1 bg-[#195737] hover:bg-[#0F4227]">
                    Saya Sudah Scan → Lanjutkan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!enabled && setupStep === 'verify' && (
          <motion.div key="verify-step" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#195737]" />
                  Verifikasi Kode
                </CardTitle>
                <CardDescription>
                  Masukkan kode 6 digit yang muncul di Google Authenticator
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifySetup} className="space-y-4">
                  <div className="flex justify-center gap-3">
                    {verifyCode.map((digit, i) => (
                      <input
                        key={i}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!/\d/.test(v) && v !== '') return
                          const nc = [...verifyCode]
                          nc[i] = v.slice(-1)
                          setVerifyCode(nc)
                          setSetupError('')
                          if (v && i < 5) {
                            const next = e.target.nextElementSibling as HTMLInputElement | null
                            next?.focus()
                          }
                        }}
                        className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2 border-slate-200 focus:border-[#195737] focus:ring-2 focus:ring-[#195737]/20 outline-none transition-all"
                      />
                    ))}
                  </div>
                  {setupError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{setupError}</span>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 text-center">Kode berubah setiap 30 detik. Pastikan waktu HP sudah tepat.</p>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => { setSetupStep('qr'); setSetupError('') }} className="flex-1">Kembali</Button>
                    <Button type="submit" disabled={setupLoading || verifyCode.join('').length !== 6} className="flex-1 bg-[#195737] hover:bg-[#0F4227]">
                      {setupLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memverifikasi...</> : 'Aktifkan 2FA'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {setupStep === 'done' && (
          <motion.div key="done-step" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
            <Card className="border-green-200">
              <CardContent className="py-10 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-bold text-green-800">2FA Berhasil Diaktifkan!</h3>
                  <p className="text-sm text-green-600 mt-1">Setiap kali login, akan diminta kode 6 digit dari Google Authenticator</p>
                </div>
                <Button variant="outline" onClick={() => setSetupStep('idle')} className="mt-4">Selesai</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {enabled && disableStep === 'idle' && (
          <motion.div key="disable-idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldOff className="w-5 h-5 text-red-500" />
                  Nonaktifkan 2FA
                </CardTitle>
                <CardDescription>Menonaktifkan 2FA akan mengurangi keamanan akun Anda</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
                  <p className="text-xs text-red-700">
                    <strong>Perhatian:</strong> Setelah 2FA dinonaktifkan, login hanya memerlukan username dan password tanpa kode verifikasi.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setDisableStep('confirm')} className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" /> Nonaktifkan 2FA
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {enabled && disableStep === 'confirm' && (
          <motion.div key="disable-confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="w-5 h-5 text-red-500" />
                  Konfirmasi Nonaktifasi
                </CardTitle>
                <CardDescription>Masukkan kode 6 digit dari Google Authenticator</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDisable} className="space-y-4">
                  <div>
                    <Label className="text-sm mb-2 block">Kode dari Google Authenticator</Label>
                    <Input
                      value={disableCode}
                      onChange={(e) => { setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setDisableError('') }}
                      placeholder="Masukkan 6 digit kode"
                      className="text-center text-xl tracking-[0.5em] font-mono"
                      maxLength={6}
                    />
                  </div>
                  {disableError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{disableError}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => { setDisableStep('idle'); setDisableCode(''); setDisableError('') }} className="flex-1">Batal</Button>
                    <Button type="submit" disabled={disableLoading || disableCode.length !== 6} variant="destructive" className="flex-1">
                      {disableLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : 'Nonaktifkan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
