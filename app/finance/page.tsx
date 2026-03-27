'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

export default function FinancePage() {
  const { profile, loading: userLoading, syncUser } = useUser()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [financeLogs, setFinanceLogs] = useState<any[]>([])
  const [bettingLogs, setBettingLogs] = useState<any[]>([])
  const [showSlip, setShowSlip] = useState(false)
  const [lastTx, setLastTx] = useState<any>(null)

  // 🎁 State สำหรับ Redeem Code
  const [promoCode, setPromoCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)

  useEffect(() => {
    if (!userLoading) {
      if (!profile) { window.location.href = '/login' } 
      else { fetchLogs() }
    }
  }, [profile, userLoading])

  const fetchLogs = async () => {
    if (!profile) return
    const { data: fLogs } = await supabase.from('finance_logs').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setFinanceLogs(fLogs || [])
    const { data: gLogs } = await supabase.from('game_logs').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    setBettingLogs(gLogs || [])
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    const withdrawAmount = parseFloat(amount)
    if (!withdrawAmount || withdrawAmount <= 0) return alert('ระบุจำนวนเงินที่ต้องการถอน')
    if (withdrawAmount > profile.balance) return alert('ยอดเงินไม่เพียงพอ')

    try {
      setLoading(true)
      await supabase.from('profiles').update({ balance: profile.balance - withdrawAmount }).eq('id', profile.id)
      const { data, error } = await supabase.from('finance_logs').insert([{ user_id: profile.id, type: 'ถอนเงิน', amount: withdrawAmount, status: 'รอดำเนินการ', description: 'ส่งคำขอถอนเงินด้วยตนเอง' }]).select().single()
      if (error) throw error
      setLastTx(data); setShowSlip(true); setAmount(''); 
      await fetchLogs(); await syncUser();
    } catch (error: any) { alert('ผิดพลาด: ' + error.message) } 
    finally { setLoading(false) }
  }

  // 🎁 ฟังก์ชันจัดการ Redeem Code
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoCode.trim()) return alert('กรุณากรอกโค้ดก่อนครับ!')
    
    try {
      setRedeemLoading(true)
      const codeUpper = promoCode.toUpperCase().trim()

      // 1. ดึงข้อมูลโค้ด
      const { data: codeData, error: codeErr } = await supabase.from('promo_codes').select('*').eq('code', codeUpper).single()
      if (codeErr || !codeData) return alert('❌ ไม่พบโค้ดนี้ หรือโค้ดไม่ถูกต้อง')

      // 2. เช็กวันหมดอายุ
      if (new Date(codeData.expires_at) < new Date()) return alert('❌ โค้ดนี้หมดอายุไปแล้วครับ')

      // 3. เช็กจำนวนสิทธิ์รวม (Max Uses)
      if (codeData.current_uses >= codeData.max_uses) return alert('❌ โค้ดนี้มีคนใช้ครบตามจำนวนแล้วครับ')

      // 4. เช็กว่าผู้ใช้คนนี้กดรับไปกี่ครั้งแล้ว (Max Uses Per User)
      const { count } = await supabase.from('promo_code_usages').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('code_id', codeData.id)
      if ((count || 0) >= codeData.max_uses_per_user) return alert(`❌ คุณใช้สิทธิ์โค้ดนี้ครบแล้ว (${codeData.max_uses_per_user} ครั้ง/คน)`)

      // 5. ดำเนินการแจกเงิน
      const reward = parseFloat(codeData.reward_amount)
      
      // อัปเดตเงินผู้เล่น
      await supabase.from('profiles').update({ balance: profile.balance + reward }).eq('id', profile.id)
      // บันทึกการใช้งาน
      await supabase.from('promo_code_usages').insert([{ user_id: profile.id, code_id: codeData.id }])
      // อัปเดตยอดการใช้โค้ดรวม
      await supabase.from('promo_codes').update({ current_uses: codeData.current_uses + 1 }).eq('id', codeData.id)
      // บันทึกประวัติการเงิน
      await supabase.from('finance_logs').insert([{ user_id: profile.id, type: 'รับชิปฟรี', amount: reward, status: 'สำเร็จ', description: `ใช้โค้ดโบนัส: ${codeUpper}` }])

      alert(`🎉 ยินดีด้วย! คุณได้รับโบนัส $${reward.toLocaleString()}`)
      setPromoCode('')
      await fetchLogs()
      await syncUser()

    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setRedeemLoading(false)
    }
  }

  if (userLoading || !profile) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold">LOADING FINANCIAL DATA...</div>

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen">
      <div className="p-10 max-w-[1100px] mx-auto w-full space-y-12 flex-1">
        
        {/* TOP SECTION: 2 COLUMNS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* 🎁 REDEEM BOX (NEW) */}
          <section className="bg-gradient-to-br from-yellow-900/40 to-black border border-yellow-500/30 rounded-[3rem] p-12 shadow-[0_0_50px_rgba(234,179,8,0.05)] relative overflow-hidden flex flex-col justify-center">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-2 tracking-tighter text-yellow-500">REDEEM CODE</h2>
              <p className="text-sm text-gray-400 mb-8 italic">กรอกโค้ดโปรโมชั่นเพื่อรับชิปฟรีทันที</p>

              <form className="space-y-6" onSubmit={handleRedeemCode}>
                <div className="group">
                  <input 
                    type="text" 
                    placeholder="ENTER CODE..." 
                    value={promoCode} 
                    onChange={(e) => setPromoCode(e.target.value)} 
                    maxLength={20}
                    className="w-full bg-black/50 border border-yellow-500/50 rounded-2xl px-6 py-5 text-2xl font-black uppercase tracking-[0.2em] outline-none focus:border-yellow-400 focus:bg-black transition-all shadow-inner text-yellow-300 placeholder-yellow-900/50 text-center" 
                  />
                </div>
                <button type="submit" disabled={redeemLoading} className="w-full bg-yellow-500 text-black font-black py-5 rounded-2xl text-sm uppercase tracking-widest hover:bg-yellow-400 transition-all shadow-xl active:scale-95 disabled:opacity-50">
                  {redeemLoading ? 'กำลังตรวจสอบสิทธิ์...' : '🎁 รับชิปฟรี'}
                </button>
              </form>
            </div>
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><span className="text-9xl">🎁</span></div>
          </section>

          {/* WITHDRAW BOX */}
          <section className="bg-[#080808] border border-gray-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-3 tracking-tighter">ถอนเงินออก</h2>
              <p className="text-sm text-gray-500 mb-10 italic opacity-60">ระบบ Stellar Paradise จะหักยอดทันทีเมื่อคุณกดยืนยัน</p>

              <form className="space-y-8" onSubmit={handleWithdraw}>
                <div className="group">
                  <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 block group-focus-within:text-white transition duration-300">ระบุจำนวนที่ต้องการถอน ($)</label>
                  <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-gray-900 py-2 text-5xl font-bold outline-none focus:border-white transition-all duration-500" />
                </div>
                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/5 shadow-inner text-center">
                    <span className="text-[9px] text-gray-600 uppercase block mb-1 font-black">BALANCE AFTER</span>
                    <span className="text-lg font-bold text-gray-300 tracking-tight">$ {(profile.balance - (parseFloat(amount) || 0)).toLocaleString()}</span>
                  </div>
                  <button type="submit" disabled={loading} className="flex-[2] bg-white text-black font-black py-5 rounded-2xl text-xs uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50">
                    {loading ? 'รอสักครู่...' : 'ยืนยันการถอน'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* LOGS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* LEFT: FINANCIAL LOGS */}
          <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-xl flex flex-col h-[650px]">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 border-l-4 border-yellow-500 pl-5 leading-none">ประวัติการเงิน</h3>
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {financeLogs.length > 0 ? financeLogs.map((log: any) => {
                const isPositive = log.type === 'ฝากเงิน' || log.type === 'เติมเงินโดยแอดมิน' || log.type === 'รับชิปฟรี';
                return (
                  <div key={log.id} className="p-5 rounded-[1.8rem] bg-black/40 border border-gray-900 hover:border-gray-700 transition duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`font-bold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>{log.type}</div>
                        <div className="text-[10px] text-gray-600 mt-1">{new Date(log.created_at).toLocaleString('th-TH')}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${isPositive ? 'text-white' : 'text-red-400'}`}>$ {log.amount.toLocaleString()}</div>
                        <div className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${log.status === 'สำเร็จ' ? 'bg-green-900/30 text-green-600' : 'bg-yellow-900/30 text-yellow-600'}`}>
                          {log.status}
                        </div>
                      </div>
                    </div>
                    {log.description && (
                      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-500 italic leading-relaxed font-medium">
                        {log.description}
                      </div>
                    )}
                  </div>
                )
              }) : <div className="text-center text-gray-800 py-20 text-sm font-black uppercase opacity-20">Empty Log</div>}
            </div>
          </section>

          {/* RIGHT: BETTING LOGS */}
          <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-xl flex flex-col h-[650px]">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 border-l-4 border-blue-500 pl-5 leading-none">ประวัติการเดิมพัน</h3>
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {bettingLogs.length > 0 ? bettingLogs.map((log: any) => (
                <div key={log.id} className="flex justify-between items-center p-5 rounded-[1.8rem] bg-black/40 border border-gray-900 hover:border-gray-700 transition">
                  <div>
                    <div className="font-bold text-sm text-gray-300">{log.game_name}</div>
                    <div className="text-[10px] text-gray-600 mt-1">{new Date(log.created_at).toLocaleString('th-TH')}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-lg ${log.change_amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {log.change_amount > 0 ? `+${log.change_amount.toLocaleString()}` : log.change_amount.toLocaleString()} $
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-tighter italic">{log.result}</div>
                  </div>
                </div>
              )) : <div className="text-center text-gray-800 py-20 text-sm font-black uppercase opacity-20">No Records</div>}
            </div>
          </section>
        </div>
      </div>

      <footer className="p-12 text-center text-[9px] text-gray-800 uppercase tracking-[0.8em] opacity-50">
          Stellar Paradise Ecosystem / Fin-Unit 2026
      </footer>

      {/* MODAL SLIP */}
      {showSlip && lastTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-xl">
          <div className="w-full max-w-[420px] bg-white text-black rounded-[3.5rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.2)]">
            <div className="bg-[#0c0c0c] text-white p-12 text-center relative overflow-hidden">
               <img src="https://iili.io/qQNVmS1.png" className="w-16 h-16 mx-auto mb-6 relative z-10 animate-pulse" alt="Logo" />
               <h3 className="text-xl font-black tracking-widest uppercase relative z-10">ทำรายการถอนเงิน</h3>
               <p className="text-[9px] opacity-40 uppercase tracking-[0.5em] mt-3 relative z-10">ยืนยันการถอนเงิน</p>
            </div>
            <div className="p-10 space-y-8">
              <div className="text-center border-b-2 border-dashed border-gray-100 pb-8">
                 <span className="text-gray-400 text-[10px] uppercase tracking-[0.2em] block mb-3 font-bold">จำนวนถอน</span>
                 <h2 className="text-6xl font-black text-black tracking-tighter">$ {lastTx.amount.toLocaleString()}</h2>
              </div>
              <div className="space-y-4 text-xs font-bold uppercase tracking-tight">
                 <div className="flex justify-between items-center"><span className="text-gray-400">วันที่/เวลา:</span><span>{new Date(lastTx.created_at).toLocaleString('th-TH')}</span></div>
                 <div className="flex justify-between items-center"><span className="text-gray-400">สถานะ:</span><span className="text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">รอการยืนยัน</span></div>
              </div>
              <button onClick={() => setShowSlip(false)} className="w-full bg-black text-white font-black py-6 rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:bg-gray-800 transition shadow-2xl active:scale-95">
                ปิดรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
