'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

export default function ManagementPage() {
  const { profile: adminProfile, loading: userLoading } = useUser()
  const [pendingLogs, setPendingLogs] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [adminLogs, setAdminLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'logs'>('pending')

  useEffect(() => {
    if (!userLoading) {
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'staff')) {
        window.location.href = '/'
      } else {
        fetchManagementData()
      }
    }
  }, [adminProfile, userLoading])

  const fetchManagementData = async () => {
    setLoading(true)
    try {
      const { data: fLogs } = await supabase.from('finance_logs').select('id, amount, status, created_at, user_id, profiles!finance_logs_user_id_fkey(username, avatar_url, balance)').eq('status', 'รอดำเนินการ').order('created_at', { ascending: true })
      setPendingLogs(fLogs || [])

      if (adminProfile.role === 'admin') {
        const { data: users } = await supabase.from('profiles').select('*').order('username')
        setAllUsers(users || [])
      }

      const { data: aLogs } = await supabase.from('admin_logs').select('*, admin:admin_id(username), target:target_user_id(username)').order('created_at', { ascending: false }).limit(100)
      setAdminLogs(aLogs || [])
    } finally { setLoading(false) }
  }

  const saveAdminLog = async (targetId: string, action: string, details: string) => {
    await supabase.from('admin_logs').insert([{ admin_id: adminProfile.id, target_user_id: targetId, action_type: action, details: details }])
  }

  const handleUpdateStatus = async (logId: number, newStatus: string, userId: string, amount: number, username: string) => {
    if (!confirm(`ยืนยันการดำเนินการสำหรับคุณ ${username}?`)) return
    try {
      if (newStatus === 'ยกเลิก') {
        const { data: u } = await supabase.from('profiles').select('balance').eq('id', userId).single()
        await supabase.from('profiles').update({ balance: u.balance + amount }).eq('id', userId)
      }
      await supabase.from('finance_logs').update({ status: newStatus }).eq('id', logId)
      await saveAdminLog(userId, `${newStatus}รายการถอน`, `จำนวนเงิน $${amount.toLocaleString()}`)
      alert('ดำเนินการสำเร็จ !')
      fetchManagementData()
    } catch (err) { alert('เกิดข้อผิดพลาด') }
  }

  const handleAdminUpdate = async (userId: string, username: string, field: string, value: any, previousValue?: any) => {
    if (!confirm(`ยืนยันการแก้ไขข้อมูลของคุณ ${username}?`)) return
    try {
      await supabase.from('profiles').update({ [field]: value }).eq('id', userId)

      if (field === 'balance') {
        const diff = value - (previousValue || 0)
        const isDeduction = diff < 0 // เช็คว่าเป็นรายการหักเงินหรือไม่
        const timestamp = new Date().toLocaleString('th-TH')
        
        // แยกประเภทและคำอธิบายตามการกระทำ
        const logType = isDeduction ? 'หักเงินโดยแอดมิน' : 'เติมเงินโดยแอดมิน'
        const actionText = isDeduction ? 'ถูกหักเงิน' : 'ได้รับเงินจากการเติมเงิน'
        const logDesc = `${actionText} โดยแอดมิน: ${adminProfile.username} จำนวน: $${Math.abs(diff).toLocaleString()} เมื่อ: ${timestamp}`

        await supabase.from('finance_logs').insert([{
          user_id: userId,
          type: logType,
          amount: Math.abs(diff),
          status: 'สำเร็จ',
          description: logDesc
        }])

        await saveAdminLog(userId, isDeduction ? 'หักเงินสมาชิก' : 'เติมเงินสมาชิก', `ยอดเดิม $${previousValue.toLocaleString()} -> ยอดใหม่ $${value.toLocaleString()} (${diff > 0 ? '+' : ''}${diff})`)
      } else {
        await saveAdminLog(userId, `แก้ไข ${field}`, `เป็น: ${value}`)
      }

      alert('ดำเนินการสำเร็จ !')
      fetchManagementData()
    } catch (err) { alert('ไม่สามารถแก้ไขได้') }
  }

  if (userLoading || !adminProfile) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black">STELLAR ADMIN LOADING...</div>

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen p-10">
      <header className="mb-10 pb-8 border-b border-gray-900 flex justify-between items-end">
          <div>
            <span className="text-xs text-gray-600 font-bold uppercase mb-2 block tracking-widest">System Control Unit</span>
            <h1 className="text-4xl font-bold uppercase tracking-tighter leading-none">Management</h1>
            <p className="text-gray-500 text-sm mt-4 italic">Operator: <span className="text-yellow-500 font-bold">{adminProfile.username}</span></p>
          </div>
          <div className="flex bg-[#080808] p-1.5 rounded-2xl border border-gray-800 font-bold text-sm uppercase shadow-2xl">
             <button onClick={()=>setActiveTab('pending')} className={`px-8 py-3 rounded-xl transition ${activeTab === 'pending' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>ถอนเงิน</button>
             {adminProfile.role === 'admin' && <button onClick={()=>setActiveTab('users')} className={`px-8 py-3 rounded-xl transition ${activeTab === 'users' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>สมาชิก</button>}
             <button onClick={()=>setActiveTab('logs')} className={`px-8 py-3 rounded-xl transition ${activeTab === 'logs' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>ประวัติแอดมิน</button>
          </div>
      </header>

      <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] overflow-hidden shadow-2xl flex-1 flex flex-col">
          {activeTab === 'pending' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead><tr className="text-xs text-gray-500 uppercase tracking-tight border-b border-gray-900 bg-[#0a0a0a]"><th className="p-8">ผู้ใช้งาน</th><th className="p-8 text-center">ยอดถอน ($)</th><th className="p-8 text-right">ดำเนินการ</th></tr></thead>
                <tbody className="divide-y divide-gray-900">{pendingLogs.map(log => <tr key={log.id} className="hover:bg-white/[0.02] transition"><td className="p-8 flex items-center space-x-5"><img src={log.profiles?.avatar_url} className="w-12 h-12 rounded-full object-cover border border-gray-800" /><div><div className="font-bold text-lg">{log.profiles?.username}</div><div className="text-xs text-gray-500">ยอดคงเหลือ: $ {log.profiles?.balance?.toLocaleString()}</div></div></td><td className="p-8 text-center font-bold text-2xl text-red-500">$ {log.amount.toLocaleString()}</td><td className="p-8 text-right space-x-4"><button onClick={()=>handleUpdateStatus(log.id, 'สำเร็จ', log.user_id, log.amount, log.profiles?.username)} className="px-7 py-3 bg-white text-black rounded-full font-bold text-xs hover:bg-green-500 transition">ยืนยัน</button><button onClick={()=>handleUpdateStatus(log.id, 'ยกเลิก', log.user_id, log.amount, log.profiles?.username)} className="px-7 py-3 border border-gray-800 text-gray-500 rounded-full font-bold text-xs hover:text-red-500 transition">ปฏิเสธ</button></td></tr>)}</tbody>
              </table>
              {pendingLogs.length === 0 && <div className="p-40 text-center text-gray-700 uppercase tracking-widest font-black opacity-20">No Pending Requests</div>}
            </div>
          )}

          {activeTab === 'users' && adminProfile.role === 'admin' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead><tr className="text-xs text-gray-500 uppercase tracking-tight border-b border-gray-900 bg-[#0a0a0a]"><th className="p-8">สมาชิก</th><th className="p-8 text-center">สิทธิ์</th><th className="p-8 text-right">ยอดเงิน ($)</th></tr></thead>
                <tbody className="divide-y divide-gray-900">{allUsers.map(u => <tr key={u.id} className="hover:bg-white/[0.02] transition"><td className="p-8 flex items-center space-x-5"><img src={u.avatar_url} className="w-11 h-11 rounded-full object-cover border border-gray-800" /><div className="font-bold text-lg">{u.username}</div></td><td className="p-8 text-center"><select value={u.role} onChange={(e)=>handleAdminUpdate(u.id, u.username, 'role', e.target.value)} className="bg-black border border-gray-800 rounded-xl px-4 py-2 text-xs font-bold text-yellow-500 uppercase outline-none"><option value="user">User</option><option value="staff">Staff</option><option value="admin">Admin</option></select></td><td className="p-8 text-right font-bold text-xl">$ {u.balance.toLocaleString()} <button onClick={()=>{const a = prompt(`ใส่ยอดที่ต้องการบวกหรือลบให้ ${u.username} (เช่น 500 หรือ -500):`); if(a) handleAdminUpdate(u.id, u.username, 'balance', u.balance + parseFloat(a), u.balance)}} className="ml-4 w-10 h-10 rounded-xl border border-gray-800 inline-flex items-center justify-center hover:bg-white hover:text-black transition">±</button></td></tr>)}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead><tr className="text-xs text-gray-500 uppercase tracking-tight border-b border-gray-900 bg-[#0a0a0a]"><th className="p-8">แอดมิน</th><th className="p-8 text-center">การกระทำ</th><th className="p-8 text-right">เวลา</th></tr></thead>
                <tbody className="divide-y divide-gray-900">{adminLogs.map(l => <tr key={l.id} className="text-sm hover:bg-white/[0.01] transition"><td className="p-8 font-bold text-white">{l.admin?.username || 'System'}</td><td className="p-8 text-center"><span className="px-3 py-1 bg-white/5 border border-white/10 rounded-md font-bold uppercase text-[10px] text-yellow-500 mr-4">{l.action_type}</span><span className="text-gray-500 text-xs">กับ {l.target?.username} ({l.details})</span></td><td className="p-8 text-right text-gray-600 text-xs">{new Date(l.created_at).toLocaleString('th-TH')}</td></tr>)}</tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  )
}