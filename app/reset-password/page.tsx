// src/app/reset-password/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) return alert('รหัสผ่านใหม่ไม่ตรงกัน')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: password })

    if (error) {
      alert("ไม่สามารถเปลี่ยนรหัสผ่านได้ : " + error.message)
    } else {
      alert("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่")
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] text-white font-['Google_Sans']">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[450px] bg-[#080808] border border-gray-800 p-12 rounded-[2.5rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-10 text-center">
             <h1 className="text-3xl font-bold mb-2">ตั้งรหัสผ่านใหม่</h1>
             <p className="text-xs text-gray-500 uppercase tracking-widest font-['Fahkwang']">Create New Password</p>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="space-y-8">
            <div>
              <label className="text-xs text-gray-500 mb-3 block uppercase tracking-tight font-['Fahkwang'] font-bold">New Password</label>
              <input 
                  type="password" 
                  className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-xl outline-none focus:border-white transition" 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-3 block uppercase tracking-tight font-['Fahkwang'] font-bold">Confirm New Password</label>
              <input 
                  type="password" 
                  className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-xl outline-none focus:border-white transition" 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••"
                  required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-white text-black font-bold py-5 rounded-full text-sm uppercase hover:bg-gray-200 transition duration-500 mt-6 shadow-xl disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}