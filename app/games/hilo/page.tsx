'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

export default function StellarHilo() {
  const { profile, syncUser } = useUser()
  const [dice, setDice] = useState([1, 2, 3])
  const [isRolling, setIsRolling] = useState(false)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [currentChip, setCurrentChip] = useState(100)
  const [resultMsg, setResultMsg] = useState({ text: '', color: '' })

  const shakeSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd = useRef<HTMLAudioElement | null>(null)
  const loseSnd = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    shakeSnd.current = new Audio('/sounds/Dice.wav')
    winSnd.current = new Audio('/sounds/Win.wav')
    loseSnd.current = new Audio('/sounds/Lose.wav')
  }, [])

  const playEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) { 
      audio.current.currentTime = 0; 
      audio.current.play().catch(() => {}); 
    }
  }

  const stopEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
  }

  // ✅ แก้ไขบั๊กตรงนี้: บังคับให้ล้างการเดิมพันข้ามกลุ่มด้วย
  const placeBet = (type: string) => {
    if (isRolling) return
    setBets(prev => {
      const newBets = { ...prev };
      const groupMain = ['HIGH', 'LOW', '11HILO']; 
      const groupNumbers = ['1', '2', '3', '4', '5', '6'];

      if (groupMain.includes(type)) {
        // ล้างกลุ่ม Main อื่นๆ
        groupMain.forEach(key => { if (key !== type) delete newBets[key]; });
        // ล้างกลุ่มตัวเลขทิ้งทั้งหมด
        groupNumbers.forEach(key => delete newBets[key]);
      }
      if (groupNumbers.includes(type)) {
        // ล้างกลุ่มตัวเลขอื่นๆ
        groupNumbers.forEach(key => { if (key !== type) delete newBets[key]; });
        // ล้างกลุ่ม Main ทิ้งทั้งหมด
        groupMain.forEach(key => delete newBets[key]);
      }
      newBets[type] = (newBets[type] || 0) + currentChip;
      return newBets;
    });
  }

  const clearBets = () => !isRolling && setBets({})

  const rollDice = async () => {
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0)
    if (totalBet <= 0 || !profile || profile.balance < totalBet) return alert('ยอดเงินไม่พอ หรือยังไม่ได้วางเดิมพัน!')

    setIsRolling(true)
    setResultMsg({ text: '', color: '' })
    playEffect(shakeSnd)

    await supabase.from('profiles').update({ balance: profile.balance - totalBet }).eq('id', profile.id)
    await syncUser()

    const interval = setInterval(() => {
      setDice([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1])
    }, 100)

    setTimeout(async () => {
      clearInterval(interval)
      stopEffect(shakeSnd)

      const finalDice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]
      setDice(finalDice)
      setIsRolling(false)
      await calculateResult(finalDice, totalBet)
    }, 2000)
  }

  const calculateResult = async (result: number[], totalInvest: number) => {
    const sum = result.reduce((a, b) => a + b, 0)
    let winAmount = 0

    if (sum === 11 && bets['11HILO']) winAmount += bets['11HILO'] * 6 
    else if (sum > 11 && sum <= 18 && bets['HIGH']) winAmount += bets['HIGH'] * 2
    else if (sum >= 3 && sum < 11 && bets['LOW']) winAmount += bets['LOW'] * 2

    const numberKeys = ['1', '2', '3', '4', '5', '6'];
    numberKeys.forEach(numStr => {
      if (bets[numStr]) {
        const count = result.filter(d => d === parseInt(numStr)).length;
        if (count > 0) winAmount += bets[numStr] + (bets[numStr] * count);
      }
    });

    if (winAmount > 0) {
      const { data: currProfile } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      const newBalance = (currProfile?.balance || 0) + winAmount
      await supabase.from('profiles').update({ balance: newBalance }).eq('id', profile!.id)
      setResultMsg({ text: `ชนะ! +$${winAmount.toLocaleString()}`, color: 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]' })
      playEffect(winSnd)
    } else {
      setResultMsg({ text: 'โบ๋! เสียใจด้วยนะ', color: 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' })
      playEffect(loseSnd)
    }

    await supabase.from('game_logs').insert([{
      user_id: profile!.id,
      game_name: 'Stellar Hilo',
      change_amount: winAmount > 0 ? winAmount - totalInvest : -totalInvest,
      result: `เต๋า: ${result.join(', ')} (รวม ${sum})`
    }])
    syncUser()
  }

  return (
    <div 
      className="flex flex-col lg:flex-row min-h-screen w-full bg-slate-950 text-white font-['Google_Sans'] overflow-x-hidden bg-cover bg-center bg-fixed select-none"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      {/* Main Play Area */}
      <div className="flex-1 flex flex-col items-center p-4 md:p-8 lg:p-12 relative overflow-y-auto">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-6 md:mb-10 drop-shadow-lg font-['Fahkwang']">
          STELLAR HILO
        </h1>

        {/* Dice Area */}
        <div className="bg-black/80 border-[4px] md:border-[8px] border-yellow-900/50 rounded-[2rem] md:rounded-[4rem] p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col items-center gap-4 md:gap-8 mb-6 md:mb-10 w-full max-w-2xl relative">
          
          {/* Decorative Glow */}
          {isRolling && <div className="absolute inset-0 bg-yellow-500/10 rounded-[2rem] md:rounded-[4rem] animate-pulse"></div>}

          <div className="flex gap-3 md:gap-6 relative z-10">
            {dice.map((val, i) => (
              <div key={i} className={`w-16 h-16 md:w-28 md:h-28 bg-gradient-to-b from-white to-gray-200 rounded-2xl md:rounded-3xl flex items-center justify-center text-4xl md:text-6xl font-black text-black shadow-[0_6px_0_#9ca3af] md:shadow-[0_10px_0_#9ca3af] border-b-4 md:border-b-8 border-gray-400 ${isRolling ? 'animate-bounce' : ''}`}>
                {val}
              </div>
            ))}
          </div>
          <div className="text-xl md:text-3xl font-black text-yellow-400 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10">
            {isRolling ? 'กำลังเขย่า...' : `ผลรวม: ${dice.reduce((a,b)=>a+b, 0)}`}
          </div>
        </div>

        {/* Betting Grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-3xl flex-1 mb-6">
          <BetSlot label="สูง" sub="12-18" value={bets['HIGH']} onClick={() => placeBet('HIGH')} color="bg-gradient-to-br from-red-900/60 to-black border-red-500/50 text-red-200 hover:border-red-400" />
          <BetSlot label="11 ไฮโล" sub="x5" value={bets['11HILO']} onClick={() => placeBet('11HILO')} color="bg-gradient-to-br from-yellow-900/60 to-black border-yellow-500/50 text-yellow-200 hover:border-yellow-400" />
          <BetSlot label="ต่ำ" sub="3-10" value={bets['LOW']} onClick={() => placeBet('LOW')} color="bg-gradient-to-br from-blue-900/60 to-black border-blue-500/50 text-blue-200 hover:border-blue-400" />
          
          {[1, 2, 3, 4, 5, 6].map(num => (
            <BetSlot key={num} label={num.toString()} sub="เต็ง" value={bets[num.toString()]} onClick={() => placeBet(num.toString())} color="bg-white/5 border-white/20 hover:border-white/50 hover:bg-white/10" />
          ))}
        </div>

        {/* Control Box */}
        <div className="w-full max-w-3xl bg-black/90 p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-xl flex flex-col gap-5 md:gap-6">
          {resultMsg.text && (
            <div className={`text-xl md:text-3xl font-black text-center animate-in zoom-in duration-300 ${resultMsg.color}`}>
              {resultMsg.text}
            </div>
          )}
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
             <div className="flex flex-wrap justify-center gap-2 md:gap-3 w-full md:w-auto">
               {[10, 100, 500, 1000].map(val => (
                 <button key={val} onClick={() => setCurrentChip(val)} className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-black text-sm md:text-base transition-all duration-300 ${currentChip === val ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                   ${val}
                 </button>
               ))}
             </div>
             <button onClick={clearBets} className="text-red-400 font-bold hover:text-red-300 uppercase text-xs md:text-sm bg-red-950/30 px-4 py-2 rounded-full border border-red-900/50 transition-colors">
               ล้างเดิมพัน
             </button>
          </div>

          <button onClick={rollDice} disabled={isRolling} className={`w-full py-4 md:py-6 font-black rounded-full text-xl md:text-2xl tracking-[0.1em] uppercase shadow-2xl transition-all duration-300 active:scale-95 ${isRolling ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-none' : 'bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 shadow-[0_0_30px_rgba(250,204,21,0.4)]'}`}>
            {isRolling ? 'กำลังเขย่าจ้า...' : 'เริ่มเลอ !'}
          </button>
        </div>
      </div>

      {/* Rules Sidebar - ย้ายมาต่อด้านล่างเมื่อเป็นมือถือ */}
      <div className="w-full lg:w-80 bg-black/85 lg:border-l border-t lg:border-t-0 border-white/10 p-6 md:p-8 flex flex-col justify-between shadow-2xl shrink-0 backdrop-blur-md z-20">
        <div className="space-y-6">
          <h3 className="text-yellow-500 font-black italic text-xl md:text-2xl border-b-2 border-white/10 pb-3 uppercase flex items-center gap-2">
            <span>ℹ️</span> กติกาไฮโล
          </h3>
          <div className="space-y-4 text-sm md:text-base font-bold text-gray-300">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-blue-400 block mb-1">🔽 ต่ำ (3-10 แต้ม)</span> จ่าย 1:1</div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-red-400 block mb-1">🔼 สูง (12-18 แต้ม)</span> จ่าย 1:1</div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-yellow-400 block mb-1">⭐ 11 ไฮโล</span> จ่าย 1:5</div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5"><span className="text-white block mb-1">🎯 เต็งเลข</span> จ่ายตามจำนวนลูกที่ออก</div>
          </div>
        </div>
        <div className="pt-6 mt-6 border-t border-white/10 text-center text-gray-600 text-[10px] md:text-xs font-bold tracking-widest">
          STELLAR ENGINE v2.0
        </div>
      </div>
    </div>
  )
}

function BetSlot({ label, sub, value, onClick, color }: { label: string; sub: string; value?: number; onClick: () => void; color: string }) {
  return (
    <div onClick={onClick} className={`${color} rounded-2xl md:rounded-3xl border-2 p-2 md:p-4 flex flex-col items-center justify-center cursor-pointer hover:scale-[1.03] transition-all duration-300 relative group overflow-hidden shadow-lg min-h-[80px] md:min-h-[120px]`}>
      <span className="text-xl md:text-3xl font-black group-hover:text-white transition-colors uppercase drop-shadow-md">{label}</span>
      <span className="text-[9px] md:text-xs font-bold text-white/50 uppercase tracking-widest mt-1">{sub}</span>
      
      {value ? (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-gradient-to-b from-yellow-300 to-yellow-600 text-black px-3 py-1 md:px-4 md:py-2 rounded-full font-black text-xs md:text-sm shadow-[0_0_15px_rgba(250,204,21,0.8)] border border-yellow-200 animate-in zoom-in duration-200">
            ${value.toLocaleString()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
