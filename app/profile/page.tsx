// app/profile/page.tsx
'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

export default function ProfilePage() {
  const { profile, loading: userLoading, syncUser } = useUser()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ win: 0, loss: 0, total: 0 })
  const [newUsername, setNewUsername] = useState('')
  const [newAvatar, setNewAvatar] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  useEffect(() => {
    if (!userLoading) {
      if (!profile) window.location.href = '/login'
      else {
        setNewUsername(profile.username)
        setNewAvatar(profile.avatar_url)
        fetchStats()
      }
    }
  }, [profile, userLoading])

  const fetchStats = async () => {
    const { data: logs } = await supabase.from('game_logs').select('*').eq('user_id', profile.id)
    if (logs) {
      setStats({ win: logs.filter(l => l.result === 'ชนะ').length, loss: logs.filter(l => l.result === 'แพ้').length, total: logs.length })
    }
  }

  const handleUpdateAvatar = async () => {
    setLoading(true)
    const { error } = await supabase.from('profiles').update({ avatar_url: newAvatar }).eq('id', profile.id)
    if (error) alert('เกิดข้อผิดพลาด') 
    else { alert('อัปเดตรูปภาพสำเร็จ'); await syncUser(); }
    setLoading(false)
  }

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) return alert('กรุณากรอกรหัสผ่านเพื่อยืนยัน')
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPassword })
    if (authError) { alert('รหัสผ่านไม่ถูกต้อง'); setLoading(false); return; }
    await supabase.from('profiles').update({ username: newUsername }).eq('id', profile.id)
    alert('อัปเดตชื่อสำเร็จ'); setCurrentPassword(''); await syncUser(); setLoading(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) return alert('รหัสไม่ตรงกัน')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) alert('พลาด: ' + error.message); else { alert('สำเร็จ'); setNewPassword(''); setConfirmNewPassword(''); }
    setLoading(false)
  }

  if (userLoading || !profile) return <div className="min-h-screen bg-black flex items-center justify-center font-['Fahkwang'] text-xs text-gray-500 tracking-widest animate-pulse">LOADING...</div>

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen">
      <div className="flex-1 p-10 flex flex-col">
        <header className="mb-12 border-b border-gray-900 pb-8 flex justify-between items-end">
           <div className="font-['Fahkwang']">
             <span className="text-xs text-gray-600 font-bold uppercase mb-2 block tracking-tight">Account Center</span>
             <h1 className="text-4xl font-bold uppercase tracking-tight">User Profile</h1>
           </div>
           <div className="text-right">
             <div className="text-xs text-gray-500 uppercase font-['Fahkwang'] mb-1">Total Balance</div>
             <div className="font-bold text-3xl text-yellow-500">$ {profile.balance?.toLocaleString()}</div>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="space-y-8">
            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 text-center shadow-2xl">
               <img src={profile.avatar_url} className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-gray-900 object-cover" />
               <h2 className="text-2xl font-bold">{profile.username}</h2>
               <p className="text-xs text-gray-600 mt-2 font-['Fahkwang'] uppercase tracking-tight">{profile.role}</p>
            </section>
            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-xl">
               <h3 className="text-xs font-bold text-gray-500 uppercase border-l-4 border-blue-500 pl-4 mb-8 font-['Fahkwang'] tracking-tight">Statistics</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/50 p-6 rounded-3xl border border-gray-900/50 text-center">
                     <div className="text-[10px] text-gray-600 uppercase mb-2 font-['Fahkwang'] tracking-tight">Win</div>
                     <div className="text-3xl font-bold text-green-500">{stats.win}</div>
                  </div>
                  <div className="bg-black/50 p-6 rounded-3xl border border-gray-900/50 text-center">
                     <div className="text-[10px] text-gray-600 uppercase mb-2 font-['Fahkwang'] tracking-tight">Loss</div>
                     <div className="text-3xl font-bold text-red-500">{stats.loss}</div>
                  </div>
               </div>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-10">
            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-2xl">
               <h3 className="text-xl font-bold mb-8">ตั้งค่าโปรไฟล์</h3>
               <div className="space-y-8">
                  <div>
                    <label className="text-xs text-gray-600 mb-3 block">ลิงก์ภาพประจำตัว (อัปเดตได้ทันที)</label>
                    <div className="flex space-x-4">
                      <input type="text" value={newAvatar} onChange={(e)=>setNewAvatar(e.target.value)} className="flex-1 bg-transparent border-b border-gray-900 py-2 text-lg outline-none focus:border-white transition" />
                      <button onClick={handleUpdateAvatar} disabled={loading} className="px-6 py-2 bg-white text-black text-xs font-bold rounded-full disabled:opacity-50">บันทึกรูป</button>
                    </div>
                  </div>
                  <form onSubmit={handleUpdateUsername} className="pt-8 border-t border-gray-900 space-y-6">
                    <label className="text-xs text-gray-600 block">ชื่อผู้ใช้งานใหม่</label>
                    <input type="text" value={newUsername} onChange={(e)=>setNewUsername(e.target.value)} className="w-full bg-transparent border-b border-gray-900 py-2 text-xl font-bold outline-none focus:border-white transition" />
                    <label className="text-xs text-yellow-600 block font-bold mt-6">ยืนยันรหัสผ่านปัจจุบันเพื่อเปลี่ยนชื่อ</label>
                    <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="w-full bg-transparent border-b border-gray-800 py-2 outline-none focus:border-yellow-500 transition" />
                    <button type="submit" disabled={loading} className="px-8 py-3 bg-white text-black text-xs font-bold rounded-full mt-4 disabled:opacity-50">บันทึกชื่อใหม่</button>
                  </form>
               </div>
            </section>

            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-2xl">
               <h3 className="text-xl font-bold mb-8 text-red-500">ความปลอดภัย</h3>
               <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <input type="password" placeholder="รหัสผ่านใหม่" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="bg-transparent border-b border-gray-900 py-2 outline-none focus:border-white" />
                  <input type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirmNewPassword} onChange={(e)=>setConfirmNewPassword(e.target.value)} className="bg-transparent border-b border-gray-900 py-2 outline-none focus:border-white" />
                  <button type="submit" disabled={loading} className="px-8 py-3 border border-red-900/50 text-red-500 text-xs font-bold rounded-full hover:bg-red-500 hover:text-white transition disabled:opacity-50 mt-4 md:col-span-2 w-max">เปลี่ยนรหัสผ่าน</button>
               </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}