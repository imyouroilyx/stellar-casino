'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // กำหนดภาพ Default ถ้าผู้เล่นไม่ได้ใส่มา
  const DEFAULT_AVATAR = 'https://i.imgur.com/bUx1oZc.png'

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // เช็กว่าถ้าช่องรูปว่าง ให้ใช้ Default Avatar แทน
    const finalAvatarUrl = avatarUrl.trim() !== '' ? avatarUrl : DEFAULT_AVATAR

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: username, avatar_url: finalAvatarUrl } }
    })

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message)
    } else if (data.user) {
      await supabase.from('profiles').insert([{ 
        id: data.user.id, 
        username, 
        email, 
        avatar_url: finalAvatarUrl, 
        balance: 0,
        role: 'user' // กำหนดสิทธิ์เริ่มต้นเป็น user
      }])
      alert("สมัครสมาชิกสำเร็จ ! กรุณาเข้าสู่ระบบ")
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] text-white font-['Google_Sans']">
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-[550px] bg-[#080808] border border-gray-800 p-12 rounded-[3rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <h1 className="text-3xl font-bold mb-10 text-center">สมัครสมาชิก</h1>
          
          <form onSubmit={handleSignUp} className="space-y-6">
            {/* พรีวิวรูปโปรไฟล์ */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-full border-2 border-gray-800 bg-black overflow-hidden flex items-center justify-center shadow-inner">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  // ถ้ายังไม่ได้พิมพ์รูป ให้โชว์รูป Default เป็นพรีวิว
                  <img src={DEFAULT_AVATAR} className="w-full h-full object-cover opacity-50" alt="Default Avatar" />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group">
                <label className="text-xs text-gray-500 mb-2 block">ชื่อผู้ใช้งาน <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="Username"
                  className="w-full bg-transparent border-b-2 border-gray-900 p-2 text-lg outline-none focus:border-white transition" 
                  onChange={(e)=>setUsername(e.target.value)} 
                  required 
                />
              </div>
              <div className="group">
                <label className="text-xs text-gray-500 mb-2 block">รูปโปรไฟล์ (URL)</label>
                <input 
                  type="text" 
                  placeholder="ถ้าไม่ใส่จะใช้ภาพเริ่มต้น"
                  className="w-full bg-transparent border-b-2 border-gray-900 p-2 text-lg outline-none focus:border-white transition text-sm" 
                  onChange={(e)=>setAvatarUrl(e.target.value)} 
                  // ✅ เอา required ออก เพื่อให้ช่องนี้เว้นว่างได้
                />
              </div>
            </div>

            <div className="group">
              <label className="text-xs text-gray-500 mb-2 block">อีเมล <span className="text-red-500">*</span></label>
              <input 
                type="email" 
                placeholder="example@email.com"
                className="w-full bg-transparent border-b-2 border-gray-900 p-2 text-lg outline-none focus:border-white transition font-light" 
                onChange={(e)=>setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="group">
              <label className="text-xs text-gray-500 mb-2 block">รหัสผ่าน <span className="text-red-500">*</span></label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-transparent border-b-2 border-gray-900 p-2 text-lg outline-none focus:border-white transition" 
                onChange={(e)=>setPassword(e.target.value)} 
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-white text-black font-bold py-5 rounded-full text-sm uppercase hover:bg-gray-200 transition duration-500 mt-8 shadow-2xl disabled:opacity-50 active:scale-95"
            >
              {loading ? 'กำลังดำเนินการ...' : 'สร้างบัญชีใหม่'}
            </button>
          </form>

          <div className="mt-10 text-center">
             <p className="text-xs text-gray-600">
               มีบัญชีอยู่แล้วใช่ไหม ? <Link href="/login" className="text-white hover:underline ml-2 font-bold">เข้าสู่ระบบที่นี่</Link>
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
