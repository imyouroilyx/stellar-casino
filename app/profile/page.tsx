// app/profile/page.tsx
'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

type GameStat = { win: number; loss: number; total: number; profit: number }
type AllStats = Record<string, GameStat>

export default function ProfilePage() {
  const { profile, loading: userLoading, syncUser } = useUser()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<AllStats>({})
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
      // เตรียมโครงสร้างสำหรับเก็บข้อมูลทุกเกม
      const newStats: AllStats = {
        'Overall': { win: 0, loss: 0, total: 0, profit: 0 },
        'Slot': { win: 0, loss: 0, total: 0, profit: 0 },
        'Wheel': { win: 0, loss: 0, total: 0, profit: 0 },
        'Hilo': { win: 0, loss: 0, total: 0, profit: 0 },
        'Fish Prawn Crab': { win: 0, loss: 0, total: 0, profit: 0 },
        'Pokdeng': { win: 0, loss: 0, total: 0, profit: 0 },
        'Kaeng': { win: 0, loss: 0, total: 0, profit: 0 }
      }

      logs.forEach(log => {
        const gameName = (log.game_name || '').toLowerCase()
        let gameKey = ''

        // แยกแยะว่ามาจากเกมไหน
        if (gameName.includes('slot')) gameKey = 'Slot'
        else if (gameName.includes('wheel')) gameKey = 'Wheel'
        else if (gameName.includes('hilo')) gameKey = 'Hilo'
        else if (gameName.includes('fish') || gameName.includes('crab') || gameName.includes('น้ำเต้า')) gameKey = 'Fish Prawn Crab'
        else if (gameName.includes('pokdeng') || gameName.includes('ป๊อกเด้ง')) gameKey = 'Pokdeng'
        else if (gameName.includes('kaeng') || gameName.includes('แคง')) gameKey = 'Kaeng'

        // ใช้ change_amount เพื่อดูว่าได้หรือเสีย (บวก = ชนะ, ลบ = แพ้)
        const amt = log.change_amount || 0
        const isWin = amt > 0
        const isLoss = amt < 0

        // บวกสถิติรวม (Overall)
        newStats['Overall'].total += 1
        newStats['Overall'].profit += amt
        if (isWin) newStats['Overall'].win += 1
        if (isLoss) newStats['Overall'].loss += 1

        // บวกสถิติรายเกม
        if (gameKey && newStats[gameKey]) {
          newStats[gameKey].total += 1
          newStats[gameKey].profit += amt
          if (isWin) newStats[gameKey].win += 1
          if (isLoss) newStats[gameKey].loss += 1
        }
      })

      setStats(newStats)
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

  const GAMES_LIST = [
    { key: 'Slot', name: 'Slot Machine', icon: '🎰' },
    { key: 'Wheel', name: 'Stellar Wheel', icon: '🎡' },
    { key: 'Hilo', name: 'Stellar Hilo', icon: '🎲' },
    { key: 'Fish Prawn Crab', name: 'เดอะล็อตโต้', icon: '💵' },
    { key: 'Pokdeng', name: 'ป๊อกเด้ง', icon: '🃏' },
    { key: 'Kaeng', name: 'ไพ่แคง', icon: '🎴' },
  ]

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen pb-10">
      <div className="flex-1 p-6 md:p-10 flex flex-col max-w-7xl mx-auto w-full">
        <header className="mb-8 md:mb-12 border-b border-gray-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
           <div className="font-['Fahkwang']">
             <span className="text-xs text-gray-600 font-bold uppercase mb-2 block tracking-tight">Account Center</span>
             <h1 className="text-4xl font-bold uppercase tracking-tight">User Profile</h1>
           </div>
           <div className="md:text-right">
             <div className="text-xs text-gray-500 uppercase font-['Fahkwang'] mb-1">Total Balance</div>
             <div className="font-bold text-4xl text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
               $ {profile.balance?.toLocaleString()}
             </div>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
          
          {/* ฝั่งซ้าย: ข้อมูลผู้ใช้ & สถิติ */}
          <div className="space-y-8 lg:col-span-1">
            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-yellow-900/20 to-transparent"></div>
               <img src={profile.avatar_url} className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-black object-cover relative z-10 shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
               <h2 className="text-2xl font-bold relative z-10">{profile.username}</h2>
               <p className="text-xs text-yellow-600 mt-2 font-['Fahkwang'] uppercase tracking-widest font-bold relative z-10">{profile.role}</p>
            </section>

            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-8 shadow-xl flex flex-col max-h-[600px]">
               <h3 className="text-xs font-bold text-gray-500 uppercase border-l-4 border-yellow-500 pl-4 mb-6 font-['Fahkwang'] tracking-tight shrink-0">
                 Game Statistics
               </h3>
               
               {/* Overall Stats */}
               <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
                  <div className="bg-gradient-to-b from-green-900/20 to-black p-4 rounded-3xl border border-green-900/30 text-center shadow-lg">
                     <div className="text-[10px] text-green-500/70 uppercase mb-1 font-['Fahkwang'] tracking-tight">Total Win</div>
                     <div className="text-3xl font-black text-green-400">{stats['Overall']?.win || 0}</div>
                  </div>
                  <div className="bg-gradient-to-b from-red-900/20 to-black p-4 rounded-3xl border border-red-900/30 text-center shadow-lg">
                     <div className="text-[10px] text-red-500/70 uppercase mb-1 font-['Fahkwang'] tracking-tight">Total Loss</div>
                     <div className="text-3xl font-black text-red-400">{stats['Overall']?.loss || 0}</div>
                  </div>
               </div>

               {/* Game Breakdown List */}
               <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                 {GAMES_LIST.map(game => {
                   const gameData = stats[game.key] || { win: 0, loss: 0, total: 0, profit: 0 }
                   return (
                     <div key={game.key} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                       <div className="flex items-center gap-3">
                         <span className="text-2xl">{game.icon}</span>
                         <div className="text-sm font-bold text-gray-200">{game.name}</div>
                       </div>
                       <div className="text-right flex flex-col">
                         <div className="text-xs font-black tracking-wider">
                           <span className="text-green-400 mr-2">W: {gameData.win}</span>
                           <span className="text-red-400">L: {gameData.loss}</span>
                         </div>
                         <div className={`text-[10px] mt-1 font-bold ${gameData.profit >= 0 ? 'text-green-500/50' : 'text-red-500/50'}`}>
                           {gameData.profit >= 0 ? '+' : ''}{gameData.profit.toLocaleString()}
                         </div>
                       </div>
                     </div>
                   )
                 })}
               </div>
            </section>
          </div>

          {/* ฝั่งขวา: ตั้งค่าบัญชี */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
               <h3 className="text-xl font-bold mb-8">ตั้งค่าโปรไฟล์</h3>
               <div className="space-y-8">
                 <div>
                   <label className="text-xs text-gray-500 mb-3 block font-bold uppercase tracking-widest">Avatar URL (ลิงก์ภาพประจำตัว)</label>
                   <div className="flex flex-col sm:flex-row gap-4">
                     <input type="text" value={newAvatar} onChange={(e)=>setNewAvatar(e.target.value)} className="flex-1 bg-black/50 border border-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-yellow-500 transition shadow-inner" />
                     <button onClick={handleUpdateAvatar} disabled={loading} className="px-6 py-3 bg-white text-black text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-yellow-400 transition-colors whitespace-nowrap">บันทึกรูป</button>
                   </div>
                 </div>
                 <form onSubmit={handleUpdateUsername} className="pt-8 border-t border-gray-900 space-y-6">
                   <label className="text-xs text-gray-500 block font-bold uppercase tracking-widest">New Username (ชื่อผู้ใช้งานใหม่)</label>
                   <input type="text" value={newUsername} onChange={(e)=>setNewUsername(e.target.value)} className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 text-lg font-bold outline-none focus:border-yellow-500 transition shadow-inner" />
                   
                   <label className="text-xs text-yellow-600 block font-bold mt-6">ยืนยันรหัสผ่านปัจจุบันเพื่อเปลี่ยนชื่อ</label>
                   <input type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500 transition shadow-inner" />
                   <button type="submit" disabled={loading} className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-sm font-bold rounded-xl mt-4 disabled:opacity-50 hover:scale-[1.02] transition-transform shadow-lg">อัปเดตชื่อผู้ใช้งาน</button>
                 </form>
               </div>
            </section>

            <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
               <h3 className="text-xl font-bold mb-8 text-red-500 flex items-center gap-2">
                 <span>🔒</span> ความปลอดภัย
               </h3>
               <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">New Password</label>
                   <input type="password" placeholder="รหัสผ่านใหม่" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition shadow-inner" />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Confirm Password</label>
                   <input type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirmNewPassword} onChange={(e)=>setConfirmNewPassword(e.target.value)} className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition shadow-inner" />
                 </div>
                 <button type="submit" disabled={loading} className="px-8 py-3 bg-red-950/30 border border-red-900 text-red-500 text-sm font-bold rounded-xl hover:bg-red-600 hover:text-white transition disabled:opacity-50 mt-2 md:col-span-2 w-full md:w-max">เปลี่ยนรหัสผ่าน</button>
               </form>
            </section>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  )
}
