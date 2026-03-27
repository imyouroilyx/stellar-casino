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

  if (userLoading || !profile) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold">LOADING FINANCIAL DATA...</div>

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen">
      <div className="p-10 max-w-[1100px] mx-auto w-full space-y-12 flex-1">
        
        {/* WITHDRAW BOX */}
        <section className="bg-[#080808] border border-gray-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3 tracking-tighter">ถอนเงินออก</h2>
            <p className="text-sm text-gray-500 mb-12 italic opacity-60">ระบบ Stellar Paradise จะหักยอดทันทีเมื่อคุณกดยืนยัน</p>

            <form className="space-y-10" onSubmit={handleWithdraw}>
              <div className="group">
                <label className="text-[10px] uppercase tracking-widest text-gray-600 mb-4 block group-focus-within:text-white transition duration-300">ระบุจำนวนที่ต้องการถอน ($)</label>
                <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent border-b-2 border-gray-900 py-4 text-6xl font-bold outline-none focus:border-white transition-all duration-500" />
              </div>
              <div className="flex items-center justify-between gap-6 pt-4">
                <div className="flex-1 p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner text-center">
                  <span className="text-[10px] text-gray-600 uppercase block mb-1 font-black">BALANCE AFTER</span>
                  <span className="text-xl font-bold text-gray-300 tracking-tight">$ {(profile.balance - (parseFloat(amount) || 0)).toLocaleString()}</span>
                </div>
                <button type="submit" disabled={loading} className="flex-[2] bg-white text-black font-black py-6 rounded-full text-sm uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-2xl active:scale-95 disabled:opacity-50">
                  {loading ? 'PROCESSING...' : 'CONFIRM WITHDRAWAL'}
                </button>
              </div>
            </form>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><img src="https://img.icons8.com/?size=500&id=22185&format=png&color=FFFFFF" className="w-64 h-64 rotate-12" alt="" /></div>
        </section>

        {/* LOGS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* LEFT: FINANCIAL LOGS */}
          <section className="bg-[#080808] border border-gray-900 rounded-[2.5rem] p-10 shadow-xl flex flex-col h-[650px]">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 border-l-4 border-yellow-500 pl-5 leading-none">Financial Activity</h3>
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {financeLogs.length > 0 ? financeLogs.map((log: any) => {
                // ✅ เพิ่ม 'หักเงินโดยแอดมิน' เป็นสีแดง
                const isPositive = log.type === 'ฝากเงิน' || log.type === 'เติมเงินโดยแอดมิน';
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
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mb-8 border-l-4 border-blue-500 pl-5 leading-none">Betting Records</h3>
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
               <h3 className="text-xl font-black tracking-widest uppercase relative z-10">RECEIPT</h3>
               <p className="text-[9px] opacity-40 uppercase tracking-[0.5em] mt-3 relative z-10">Withdrawal Confirmation</p>
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top,_#444_0%,_#000_100%)] opacity-80"></div>
            </div>
            <div className="p-10 space-y-8">
              <div className="text-center border-b-2 border-dashed border-gray-100 pb-8">
                 <span className="text-gray-400 text-[10px] uppercase tracking-[0.2em] block mb-3 font-bold">Total Amount Deducted</span>
                 <h2 className="text-6xl font-black text-black tracking-tighter">$ {lastTx.amount.toLocaleString()}</h2>
              </div>
              <div className="space-y-4 text-xs font-bold uppercase tracking-tight">
                 <div className="flex justify-between items-center"><span className="text-gray-400">Date/Time:</span><span>{new Date(lastTx.created_at).toLocaleString('th-TH')}</span></div>
                 <div className="flex justify-between items-center"><span className="text-gray-400">Status:</span><span className="text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full">Pending Approval</span></div>
              </div>
              <button onClick={() => setShowSlip(false)} className="w-full bg-black text-white font-black py-6 rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:bg-gray-800 transition shadow-2xl active:scale-95">
                Close Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}