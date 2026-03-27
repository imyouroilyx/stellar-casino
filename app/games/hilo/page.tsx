// src/app/games/hilo/page.tsx
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
  const loseSnd = useRef<HTMLAudioElement | null>(null) // ✅ เพิ่ม Ref เสียงแพ้

  useEffect(() => {
    shakeSnd.current = new Audio('/sounds/dice.wav')
    winSnd.current = new Audio('/sounds/Win.wav')
    loseSnd.current = new Audio('/sounds/Lose.wav') // ✅ โหลดไฟล์ Lose.wav
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

  const placeBet = (type: string) => {
    if (isRolling) return
    setBets(prev => {
      const newBets = { ...prev };
      const groupMain = ['HIGH', 'LOW', '11HILO']; 
      const groupNumbers = ['1', '2', '3', '4', '5', '6'];

      if (groupMain.includes(type)) {
        groupMain.forEach(key => { if (key !== type) delete newBets[key]; });
      }
      if (groupNumbers.includes(type)) {
        groupNumbers.forEach(key => { if (key !== type) delete newBets[key]; });
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
      stopEffect(shakeSnd) // หยุดเสียงเขย่าทันทีเมื่อลูกเต๋านิ่ง

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
      setResultMsg({ text: `ชนะ! +$${winAmount}`, color: 'text-green-400' })
      playEffect(winSnd)
    } else {
      setResultMsg({ text: 'โบ๋! เสียใจด้วยนะ', color: 'text-red-500' })
      playEffect(loseSnd) // ✅ เล่นเสียงแพ้
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
    <div className="flex h-screen w-full bg-slate-950 text-white font-['Google_Sans'] overflow-hidden select-none">
      <div className="flex-1 flex flex-col items-center p-6 relative">
        <h1 className="text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-8">STELLAR HILO</h1>

        {/* Dice Area */}
        <div className="bg-black/60 border-[10px] border-yellow-900/40 rounded-[4rem] p-10 shadow-2xl backdrop-blur-md flex flex-col items-center gap-6 mb-8 w-full max-w-xl">
          <div className="flex gap-6">
            {dice.map((val, i) => (
              <div key={i} className={`w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-5xl font-black text-black shadow-[0_10px_0_#ccc] border-b-8 border-gray-300 ${isRolling ? 'animate-bounce' : ''}`}>
                {val}
              </div>
            ))}
          </div>
          <div className="text-3xl font-black text-yellow-500 tracking-widest uppercase">
            {isRolling ? 'กำลังเขย่า...' : `ผลรวม: ${dice.reduce((a,b)=>a+b, 0)}`}
          </div>
        </div>

        {/* Betting Grid */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-3xl flex-1 max-h-[400px]">
          <BetSlot label="สูง" sub="12-18" value={bets['HIGH']} onClick={() => placeBet('HIGH')} color="bg-red-900/40 border-red-500/50" />
          <BetSlot label="11 ไฮโล" sub="x5" value={bets['11HILO']} onClick={() => placeBet('11HILO')} color="bg-yellow-900/40 border-yellow-500/50" />
          <BetSlot label="ต่ำ" sub="3-10" value={bets['LOW']} onClick={() => placeBet('LOW')} color="bg-blue-900/40 border-blue-500/50" />
          {[1, 2, 3, 4, 5, 6].map(num => (
            <BetSlot key={num} label={num.toString()} sub="เต็ง" value={bets[num.toString()]} onClick={() => placeBet(num.toString())} color="bg-white/5 border-white/10" />
          ))}
        </div>

        {/* Control Box */}
        <div className="w-full max-w-2xl bg-black/90 p-6 rounded-[2.5rem] border border-white/10 mt-6 shadow-2xl flex flex-col gap-4">
          {resultMsg.text && <div className={`text-2xl font-black text-center animate-pulse ${resultMsg.color}`}>{resultMsg.text}</div>}
          
          <div className="flex justify-between items-center px-4">
             <div className="flex gap-2">
                {[10, 100, 500, 1000].map(val => (
                  <button key={val} onClick={() => setCurrentChip(val)} className={`px-4 py-2 rounded-xl font-black transition-all ${currentChip === val ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-white/10 text-gray-400'}`}>
                    ${val}
                  </button>
                ))}
             </div>
             <button onClick={clearBets} className="text-red-400 font-bold hover:text-red-300 uppercase text-xs">ล้างเดิมพัน</button>
          </div>

          <button onClick={rollDice} disabled={isRolling} className="w-full py-5 bg-white text-black font-black rounded-full text-2xl hover:bg-yellow-500 shadow-xl disabled:opacity-30 transition-all active:scale-95">
            {isRolling ? 'กำลังเขย่าจ้า...' : 'เริ่มเลอ'}
          </button>
        </div>
      </div>

      {/* Rules Sidebar */}
      <div className="w-80 bg-black/85 border-l border-white/10 p-8 flex flex-col justify-between shadow-2xl shrink-0">
        <div className="space-y-6">
          <h3 className="text-yellow-500 font-black italic text-2xl border-b-2 border-white/10 pb-3 uppercase">ไฮโล</h3>
          <div className="space-y-4 text-[14px] font-bold text-gray-300">
            <p><span className="text-blue-400">• ต่ำ:</span> 3-10 แต้ม (1:1)</p>
            <p><span className="text-red-400">• สูง:</span> 12-18 แต้ม (1:1)</p>
            <p><span className="text-yellow-500">• 11 ไฮโล:</span> รวม 11 (1:5)</p>
            <p><span className="text-white">• เต็ง:</span> เลือก 1 เลข ต่อรอบ</p>
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 text-center opacity-20 text-[10px]">STELLAR ENGINE v1.5</div>
      </div>
    </div>
  )
}

function BetSlot({ label, sub, value, onClick, color }: { label: string; sub: string; value?: number; onClick: () => void; color: string }) {
  return (
    <div onClick={onClick} className={`${color} rounded-3xl border-2 p-4 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all relative group overflow-hidden shadow-lg`}>
      <span className="text-2xl font-black group-hover:text-yellow-500 transition-colors uppercase">{label}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{sub}</span>
      {value ? (
        <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center backdrop-blur-[2px]">
          <div className="bg-yellow-500 text-black px-3 py-1 rounded-full font-black text-sm shadow-xl border-2 border-black animate-in zoom-in duration-200">${value}</div>
        </div>
      ) : null}
    </div>
  )
}