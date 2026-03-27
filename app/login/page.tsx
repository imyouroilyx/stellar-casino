// src/app/login/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // ดึงชื่อผู้ใช้งานที่เคยจำไว้มาใส่ให้เลย
  useEffect(() => {
    const savedUser = localStorage.getItem('stellar_remembered_user')
    if (savedUser) {
      setUsername(savedUser)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', username)
        .single()

      if (findError || !profile) {
        alert("ไม่พบชื่อผู้ใช้งานนี้ในระบบ")
        setLoading(false)
        return
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password,
      })

      if (loginError) {
        alert("รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง")
      } else {
        // ถ้าเลือกจดจำฉัน ให้เก็บชื่อไว้ในเครื่อง
        if (rememberMe) {
          localStorage.setItem('stellar_remembered_user', username)
        } else {
          localStorage.removeItem('stellar_remembered_user')
        }
        window.location.href = '/'
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] text-white font-['Google_Sans']">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[450px] bg-[#080808] border border-gray-800 p-12 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          
          <div className="mb-10 text-center">
             <h1 className="text-3xl font-bold mb-2">เข้าสู่ระบบ</h1>
             <p className="text-[10px] text-gray-600 uppercase tracking-widest font-['Fahkwang']">Stellar Paradise Account</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-8">
            <div>
              <label className="text-xs text-gray-500 mb-3 block uppercase tracking-tight font-['Fahkwang'] font-bold">Username</label>
              <input 
                  type="text" 
                  value={username}
                  className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-xl outline-none focus:border-white transition font-light" 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="ชื่อผู้ใช้งาน"
                  required 
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-3 block uppercase tracking-tight font-['Fahkwang'] font-bold">Password</label>
              <input 
                  type="password" 
                  className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-xl outline-none focus:border-white transition" 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-800 bg-black checked:bg-white transition"
                />
                <span className="text-xs text-gray-500 group-hover:text-white transition">จดจำชื่อผู้ใช้งาน</span>
              </label>
              <Link href="/forgot-password" virtual-link="true" className="text-xs text-gray-500 hover:text-white transition">ลืมรหัสผ่าน ?</Link>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-white text-black font-bold py-5 rounded-full text-sm uppercase hover:bg-gray-200 transition duration-500 shadow-xl disabled:opacity-50"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่สเตลลาพาราไดซ์'}
            </button>
          </form>

          <div className="mt-10 text-center border-t border-gray-900 pt-8">
             <p className="text-xs text-gray-600">
                ยังไม่มีบัญชีใช่ไหม ? <Link href="/register" className="text-white hover:underline ml-2 font-bold">สมัครสมาชิกที่นี่</Link>
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}