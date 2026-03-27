// src/app/games/wheel/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

// ✅ สร้าง 100 ช่องแบบอัตโนมัติ แจ็กพ็อต 1 ช่อง
// สัดส่วน: JP x50 (1), x5 (2), x2 (5), x1 (20), โบ๋ x0 (72) -> RTP รวม 90%
const PRIZES = Array.from({ length: 100 }).map((_, i) => {
  if (i === 0) return { label: 'JP', multiplier: 50, color: '#D97706' }; // 1 ช่อง
  if (i === 33 || i === 66) return { label: 'x5', multiplier: 5, color: '#DB2777' }; // 2 ช่อง
  if (i % 20 === 10) return { label: 'x2', multiplier: 2, color: '#4F46E5' }; // 5 ช่อง
  if (i % 5 === 0 && i !== 0) return { label: 'x1', multiplier: 1, color: '#1E3A8A' }; // 19 ช่อง
  if (i === 99) return { label: 'x1', multiplier: 1, color: '#1E3A8A' }; // เติมให้ครบ 20 ช่อง
  // ช่องที่เหลือเป็น x0 และไม่ใส่ label เพื่อลดความรกของวงล้อ
  return { label: '', multiplier: 0, color: i % 2 === 0 ? '#0A0F24' : '#111827' };
});

export default function LuckyWheel() {
  const { profile, syncUser } = useUser()
  const [bet, setBet] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [showWinModal, setShowWinModal] = useState(false)
  const [winData, setWinData] = useState({ amount: 0, label: '' })

  const spinSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd = useRef<HTMLAudioElement | null>(null)
  const loseSnd = useRef<HTMLAudioElement | null>(null)

  const wheelRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(0)
  const isIdleRef = useRef(true)

  useEffect(() => {
    spinSnd.current = new Audio('/sounds/Wheelspin.wav')
    winSnd.current = new Audio('/sounds/Win.wav')
    loseSnd.current = new Audio('/sounds/Lose.wav')

    let rAF: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (isIdleRef.current && wheelRef.current) {
        const delta = time - lastTime;
        rotationRef.current += 0.02 * delta; 
        wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
      }
      lastTime = time;
      rAF = requestAnimationFrame(loop);
    }
    
    rAF = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rAF);
  }, [])

  const playEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) {
      audio.current.currentTime = 0
      audio.current.play().catch(() => {})
    }
  }

  const startSpin = async () => {
    if (spinning || !profile) return
    if (bet <= 0) return alert('กรุณาใส่ยอดเดิมพันที่มากกว่า 0')
    if (profile.balance < bet) return alert('ยอดเงินไม่เพียงพอ !')

    setSpinning(true)
    setShowWinModal(false)
    isIdleRef.current = false 
    playEffect(spinSnd)

    try {
      await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
      await syncUser()

      const prizeIndex = Math.floor(Math.random() * PRIZES.length)
      const prize = PRIZES[prizeIndex]
      
      const segmentDeg = 360 / PRIZES.length
      const targetDeg = 270 - (prizeIndex * segmentDeg) - (segmentDeg / 2)
      
      const currentRot = rotationRef.current
      const currentMod = currentRot % 360
      let degDiff = targetDeg - currentMod
      if (degDiff <= 0) degDiff += 360 
      
      const extraRounds = 360 * 10 // หมุน 10 รอบ
      const finalRotation = currentRot + extraRounds + degDiff
      
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 6000ms cubic-bezier(0.1, 0, 0.1, 1)' // เพิ่มเวลาเล็กน้อยเพราะวงล้อละเอียด
        wheelRef.current.style.transform = `rotate(${finalRotation}deg)`
      }
      rotationRef.current = finalRotation

      setTimeout(async () => {
        setSpinning(false)
        if (spinSnd.current) {
          spinSnd.current.pause()
          spinSnd.current.currentTime = 0
        }

        const winAmount = Math.floor(bet * prize.multiplier)
        const displayLabel = prize.label === '' ? 'โบ๋' : prize.label

        setWinData({ amount: winAmount, label: displayLabel })

        if (winAmount > 0) {
          playEffect(winSnd)
          const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile.id).single()
          await supabase.from('profiles').update({ balance: (curr?.balance || 0) + winAmount }).eq('id', profile.id)
        } else {
          playEffect(loseSnd)
        }

        await supabase.from('game_logs').insert([{
          user_id: profile.id,
          game_name: 'Stellar Wheel',
          change_amount: winAmount > 0 ? winAmount : -bet,
          result: `ได้รางวัล ${displayLabel}`
        }])

        setShowWinModal(true)
        syncUser()

        if (wheelRef.current) {
          wheelRef.current.style.transition = 'none'
        }
        isIdleRef.current = true 

      }, 6000)

    } catch (err) {
      setSpinning(false)
      isIdleRef.current = true
      if (wheelRef.current) wheelRef.current.style.transition = 'none'
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  return (
    <div 
      className="min-h-screen text-white flex flex-col items-center justify-center p-6 bg-cover bg-center overflow-hidden font-['Google_Sans']"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      <div className="z-10 flex flex-col items-center space-y-12 max-w-2xl w-full mt-10">
        
        <div className="text-center">
          <h1 className="font-['Fahkwang'] text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg">
            STELLAR WHEEL
          </h1>
          <p className="text-xl md:text-2xl font-bold text-[#a0b1c3] uppercase tracking-[0.2em] mt-2">หมุนลุ้นโชคแห่งดวงดาว</p>
        </div>

        <div className="relative flex items-center justify-center w-full my-8">
          <div className="absolute left-[-20px] md:left-[-60px] z-30 text-5xl md:text-8xl text-yellow-400 drop-shadow-[0_0_25px_rgba(255,215,0,0.9)] animate-pulse">
            ➽
          </div>

          <div className="w-[320px] h-[320px] md:w-[550px] md:h-[550px] rounded-full p-3 md:p-5 bg-gradient-to-br from-yellow-300 via-yellow-600 to-yellow-900 shadow-[0_0_60px_rgba(218,165,32,0.4)] flex items-center justify-center relative">
            
            <div 
              ref={wheelRef}
              className="w-full h-full rounded-full relative shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-hidden"
              style={{ 
                background: `conic-gradient(${PRIZES.map((p, i) => `${p.color} ${i * (100 / PRIZES.length)}% ${(i + 1) * (100 / PRIZES.length)}%`).join(', ')})`
              }}
            >
              {PRIZES.map((p, i) => {
                const rot = i * (360 / PRIZES.length) + (360 / PRIZES.length / 2);
                const isJackpot = p.label === 'JP';
                return (
                  <React.Fragment key={i}>
                    {/* เส้นแบ่งช่องแบบบางและจางลงมาก ๆ สำหรับ 100 ช่อง */}
                    <div 
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 w-[1px] bg-white/5 origin-bottom z-10"
                      style={{ transform: `rotate(${i * (360 / PRIZES.length)}deg)` }}
                    />
                    
                    {/* แสดงตัวอักษรเฉพาะช่องที่มีรางวัล */}
                    {p.label && (
                      <div 
                        className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 flex items-start justify-center pt-1 md:pt-2 z-20 origin-bottom"
                        style={{ transform: `rotate(${rot}deg)` }}
                      >
                        <span className={`font-black uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tighter ${isJackpot ? 'text-yellow-300 text-[8px] md:text-[12px] animate-pulse drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' : 'text-white/95 text-[6px] md:text-[9px]'}`}>
                          {p.label}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="absolute w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-gray-800 to-[#0A0F24] rounded-full border-4 border-yellow-500 shadow-[0_0_30px_rgba(0,0,0,0.9)] flex items-center justify-center z-30">
              <div className="w-5 h-5 md:w-8 md:h-8 bg-yellow-400 rounded-full shadow-[0_0_15px_#FCD34D] animate-ping opacity-75"></div>
              <div className="absolute w-3 h-3 md:w-5 md:h-5 bg-white rounded-full"></div>
            </div>

          </div>
        </div>

        <div className="w-full max-w-md bg-black/80 border border-white/10 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-8 px-4">
            <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest">เงินเดิมพัน</span>
            <div className="flex items-center space-x-6">
              <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="text-3xl opacity-40 hover:opacity-100 transition disabled:opacity-0 hover:text-yellow-400">－</button>
              <div className="flex items-center">
                <span className="text-3xl md:text-4xl font-bold text-yellow-500 mr-2">$</span>
                <input 
                  type="number" 
                  value={bet} 
                  onChange={(e) => setBet(parseInt(e.target.value) || 0)}
                  disabled={spinning}
                  className="bg-transparent text-3xl md:text-4xl font-bold text-center w-24 md:w-28 focus:outline-none text-yellow-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <button onClick={() => setBet(bet + 10)} disabled={spinning} className="text-3xl opacity-40 hover:opacity-100 transition disabled:opacity-0 hover:text-yellow-400">＋</button>
            </div>
          </div>

          <button 
            onClick={startSpin}
            disabled={spinning}
            className={`w-full py-6 md:py-7 rounded-full font-black text-xl tracking-[0.2em] uppercase transition-all duration-300 ${spinning ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 shadow-[0_0_30px_rgba(218,165,32,0.5)] hover:scale-105 active:scale-95'}`}
          >
            {spinning ? 'กำลังหมุน...' : 'เสี่ยงโชคเลย !'}
          </button>
        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`w-full max-w-md bg-[#0a0a0a]/95 border-2 p-12 md:p-16 rounded-[4rem] text-center shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-20 duration-500 ${winData.amount > 0 ? 'border-yellow-500/50' : 'border-red-900/50'}`}>
            <h2 className={`text-5xl font-black uppercase font-['Fahkwang'] mb-6 ${winData.amount > 0 ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]' : 'text-red-600'}`}>
              {winData.amount > 0 ? 'ยินดีด้วย !' : 'แพ้ซะแล้ว'}
            </h2>
            <p className="text-xl md:text-2xl font-bold text-[#a0b1c3] mb-10 leading-relaxed">
              {winData.amount > 0 
                ? `รับรางวัล ${winData.label} ($ ${winData.amount.toLocaleString()})` 
                : 'เสียใจด้วยนะ ลองใหม่อีกครั้งจ้า'}
            </p>
            <button 
              onClick={() => setShowWinModal(false)}
              className="w-full py-5 md:py-6 bg-white text-black font-bold rounded-full text-sm uppercase tracking-widest hover:bg-yellow-500 transition-colors shadow-lg"
            >
              เล่นต่อเลย !
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
