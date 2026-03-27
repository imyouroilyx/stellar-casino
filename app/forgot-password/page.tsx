// src/app/forgot-password/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      alert("เกิดข้อผิดพลาด : " + error.message)
    } else {
      setMessage("ส่งลิงก์กู้คืนรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบในกล่องข้อความ (หรือใน Junk Mail)")
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] text-white font-['Google_Sans']">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[450px] bg-[#080808] border border-gray-800 p-12 rounded-[2.5rem] shadow-2xl animate-in fade-in duration-500">
          <div className="mb-10 text-center">
             <h1 className="text-3xl font-bold mb-2">ลืมรหัสผ่าน</h1>
             <p className="text-xs text-gray-500">ระบุอีเมลที่คุณใช้สมัครสมาชิก เพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
          </div>
          
          {message ? (
            <div className="text-center space-y-8">
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-3xl text-green-500 text-sm leading-relaxed">
                {message}
              </div>
              <Link href="/login" className="block w-full bg-white text-black font-bold py-5 rounded-full text-sm uppercase text-center">กลับหน้าล็อกอิน</Link>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-10">
              <div>
                <label className="text-xs text-gray-500 mb-3 block uppercase tracking-tight font-['Fahkwang'] font-bold">Email Address</label>
                <input 
                    type="email" 
                    className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-xl outline-none focus:border-white transition font-light" 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="example@email.com"
                    required 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-white text-black font-bold py-5 rounded-full text-sm uppercase hover:bg-gray-200 transition duration-500 shadow-xl disabled:opacity-50"
              >
                {loading ? 'กำลังส่งข้อมูล...' : 'ส่งลิงก์กู้คืนรหัสผ่าน'}
              </button>

              <div className="text-center">
                <Link href="/login" className="text-xs text-gray-500 hover:text-white transition">ยกเลิกและกลับหน้าเดิม</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}