// src/app/games/wheel/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

// ✅ สร้างวงล้อ 100 ช่องอัตโนมัติ และกระจายรางวัลให้สม่ำเสมอทั่ววงล้อ
const PRIZES = Array.from({ length: 100 }).map((_, i) => {
  // 1. แจ็กพ็อต 1 ช่อง (x30)
  if (i === 0) return { label: 'JP', multiplier: 30, color: '#D97706' };
  
  // 2. รางวัล x4 จำนวน 5 ช่อง (ทุก ๆ 20 ช่อง)
  if (i % 20 === 10) return { label: 'x4', multiplier: 4, color: '#7C3AED' };
  
  // 3. รางวัล x3 จำนวน 10 ช่อง (ทุก ๆ 10 ช่อง)
  if (i % 10 === 5 && i % 20 !== 10) return { label: 'x3', multiplier: 3, color: '#DB2777' };
  
  // 4. รางวัล x2 จำนวน 20 ช่อง
  if (i % 5 === 2 || i % 5 === 3) {
    return { label: 'x2', multiplier: 2, color: '#1E3A8A' };
  }

  // 5. ที่เหลือ 64 ช่อง เป็น x0
  return { label: 'x0', multiplier: 0, color: '#0A0F24' };
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
      // หักเงินเดิมพัน
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ balance: profile.balance - bet })
        .eq('id', profile.id)

      if (deductError) {
        throw new Error('ไม่สามารถหักเงินเดิมพันได้')
      }

      await syncUser()

      const prizeIndex = Math.floor(Math.random() * PRIZES.length)
      const prize = PRIZES[prizeIndex]
      
      const segmentDeg = 360 / PRIZES.length
      const targetDeg = 270 - (prizeIndex * segmentDeg) - (segmentDeg / 2)
      
      const currentRot = rotationRef.current
      const currentMod = currentRot % 360
      let degDiff = targetDeg - currentMod
      if (degDiff <= 0) degDiff += 360 
      
      const extraRounds = 360 * 10 
      const finalRotation = currentRot + extraRounds + degDiff
      
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'transform 5000ms cubic-bezier(0.1, 0, 0.1, 1)'
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
        setWinData({ amount: winAmount, label: prize.label })

        try {
          if (winAmount > 0) {
            playEffect(winSnd)
            
            // 🔥 แก้ไข: ดึง balance ปัจจุบันและตรวจสอบ error
            const { data: curr, error: fetchError } = await supabase
              .from('profiles')
              .select('balance')
              .eq('id', profile.id)
              .single()

            if (fetchError || !curr) {
              throw new Error('ไม่สามารถดึงข้อมูล balance ได้')
            }

            // อัพเดทเงินรางวัล
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ balance: curr.balance + winAmount })
              .eq('id', profile.id)

            if (updateError) {
              throw new Error('ไม่สามารถอัพเดทเงินรางวัลได้')
            }
          } else {
            playEffect(loseSnd)
          }

          // บันทึก log
          await supabase.from('game_logs').insert([{
            user_id: profile.id,
            game_name: 'Stellar Wheel',
            change_amount: winAmount > 0 ? winAmount - bet : -bet,
            result: `ได้รางวัล ${prize.label}`
          }])

          // 🔥 Sync ก่อนแสดง modal
          await syncUser()
          setShowWinModal(true)

        } catch (error) {
          console.error('Error updating balance:', error)
          alert('เกิดข้อผิดพลาดในการอัพเดทเงิน กรุณาติดต่อแอดมิน')
        }

        if (wheelRef.current) {
          wheelRef.current.style.transition = 'none'
        }
        isIdleRef.current = true

      }, 5000)

    } catch (err) {
      console.error('Spin error:', err)
      setSpinning(false)
      isIdleRef.current = true
      if (wheelRef.current) wheelRef.current.style.transition = 'none'
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  return (
    <div 
      className="min-h-screen text-white flex flex-col items-center p-4 bg-cover bg-center overflow-x-hidden font-['Google_Sans']"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      <div className="z-10 w-full max-w-7xl py-4 md:py-8">
        
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="font-['Fahkwang'] text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg">
            วงล้อนำโชค
          </h1>
          <p className="text-sm sm:text-base md:text-xl font-bold text-[#a0b1c3] uppercase tracking-[0.15em] md:tracking-[0.2em] mt-2">หมุนลุ้นรางวัลใหญ่</p>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 md:gap-6 lg:gap-12 items-start max-w-6xl mx-auto">
          
          {/* Mobile: วงล้อก่อน, Desktop: กติกาก่อน */}
          <div className="order-2 lg:order-1 w-full bg-black/60 border border-yellow-500/30 rounded-2xl md:rounded-3xl p-4 md:p-6 backdrop-blur-md">
            <h2 className="font-['Fahkwang'] text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400 mb-4 md:mb-6 text-center">📋 กติกาการเล่น</h2>
            
            <div className="space-y-3 md:space-y-4 text-sm sm:text-base md:text-lg">
              <div className="flex items-center space-x-2 md:space-x-3">
                <span className="text-2xl md:text-3xl">🎯</span>
                <p className="text-gray-200">วางเดิมพันขั้นต่ำ <span className="text-yellow-400 font-bold">$10</span></p>
              </div>
              
              <div className="flex items-center space-x-2 md:space-x-3">
                <span className="text-2xl md:text-3xl">🎰</span>
                <p className="text-gray-200">หมุนวงล้อ <span className="text-yellow-400 font-bold">100 ช่อง</span></p>
              </div>

              <div className="border-t border-yellow-500/20 pt-3 md:pt-4 mt-3 md:mt-4">
                <h3 className="font-bold text-yellow-300 mb-2 md:mb-3 text-base sm:text-lg md:text-xl">💰 ตารางรางวัล</h3>
                
                <div className="space-y-1.5 md:space-y-2">
                  <div className="flex justify-between items-center bg-gradient-to-r from-yellow-600/20 to-transparent p-2 md:p-3 rounded-lg border border-yellow-500/30">
                    <span className="font-black text-yellow-300 text-base sm:text-lg md:text-xl">JP</span>
                    <span className="text-yellow-400 font-bold text-sm sm:text-base md:text-lg">x30 🔥</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gradient-to-r from-purple-600/20 to-transparent p-2 md:p-3 rounded-lg border border-purple-500/30">
                    <span className="font-black text-purple-300 text-base sm:text-lg md:text-xl">x4</span>
                    <span className="text-purple-400 font-bold text-sm sm:text-base md:text-lg">5 ช่อง</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gradient-to-r from-pink-600/20 to-transparent p-2 md:p-3 rounded-lg border border-pink-500/30">
                    <span className="font-black text-pink-300 text-base sm:text-lg md:text-xl">x3</span>
                    <span className="text-pink-400 font-bold text-sm sm:text-base md:text-lg">10 ช่อง</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gradient-to-r from-blue-600/20 to-transparent p-2 md:p-3 rounded-lg border border-blue-500/30">
                    <span className="font-black text-blue-300 text-base sm:text-lg md:text-xl">x2</span>
                    <span className="text-blue-400 font-bold text-sm sm:text-base md:text-lg">20 ช่อง</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gradient-to-r from-gray-600/20 to-transparent p-2 md:p-3 rounded-lg border border-gray-500/30">
                    <span className="font-black text-gray-300 text-base sm:text-lg md:text-xl">x0</span>
                    <span className="text-gray-400 font-bold text-sm sm:text-base md:text-lg">64 ช่อง</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-yellow-500/20 pt-3 md:pt-4 mt-3 md:mt-4">
                <div className="flex items-start space-x-2 md:space-x-3">
                  <span className="text-xl md:text-2xl">✨</span>
                  <p className="text-gray-300 text-xs sm:text-sm md:text-base leading-relaxed">
                    ตัวอย่าง: เดิมพัน <span className="text-yellow-400 font-bold">$100</span> ถูก <span className="text-yellow-400 font-bold">JP</span> 
                    <br/>ได้รับ <span className="text-green-400 font-bold">$3,000</span> 🎊
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Wheel Section */}
          <div className="order-1 lg:order-2 w-full flex flex-col items-center space-y-4 md:space-y-6">
            
            {/* Wheel Container */}
            <div className="relative flex items-center justify-center w-full">
              <div className="absolute left-[-15px] sm:left-[-20px] md:left-[-30px] lg:left-[-40px] z-30 text-3xl sm:text-4xl md:text-6xl lg:text-8xl text-yellow-400 drop-shadow-[0_0_25px_rgba(255,215,0,0.9)] animate-pulse">
                ➽
              </div>

              <div className="w-[260px] sm:w-[320px] md:w-[400px] lg:w-[500px] aspect-square rounded-full p-2 md:p-3 bg-gradient-to-br from-yellow-300 via-yellow-600 to-yellow-900 shadow-[0_0_60px_rgba(218,165,32,0.4)] flex items-center justify-center relative">
                
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
                    const isSpecial = p.label === 'x4' || p.label === 'x3';
                    return (
                      <React.Fragment key={i}>
                        <div 
                          className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 flex items-start justify-center pt-0.5 sm:pt-1 md:pt-2 z-20 origin-bottom"
                          style={{ transform: `rotate(${rot}deg)` }}
                        >
                          <div className={`font-black uppercase tracking-tighter origin-top ${
                            isJackpot 
                              ? 'text-yellow-300 text-[8px] sm:text-[10px] md:text-xs lg:text-sm animate-pulse drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]' 
                              : isSpecial
                              ? 'text-white/80 text-[8px] sm:text-[10px] scale-[0.45] sm:scale-[0.5] md:scale-[0.6]'
                              : 'text-white/50 text-[8px] sm:text-[10px] scale-[0.25] sm:scale-[0.3] md:scale-[0.4]'
                          }`}>
                            {p.label}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="absolute w-12 sm:w-14 md:w-20 lg:w-24 aspect-square bg-gradient-to-br from-gray-800 to-[#0A0F24] rounded-full border-2 sm:border-3 md:border-4 border-yellow-500 shadow-[0_0_30px_rgba(0,0,0,0.9)] flex items-center justify-center z-30">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 lg:w-8 lg:h-8 bg-yellow-400 rounded-full shadow-[0_0_15px_#FCD34D] animate-ping opacity-75"></div>
                  <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-4 md:h-4 lg:w-5 lg:h-5 bg-white rounded-full"></div>
                </div>

              </div>
            </div>

            {/* Bet Control */}
            <div className="w-full max-w-md bg-black/80 border border-white/10 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl backdrop-blur-md">
              <div className="flex justify-between items-center mb-4 md:mb-6 px-1 sm:px-2">
                <span className="text-[10px] sm:text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider md:tracking-widest">ยอดเดิมพัน</span>
                <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6">
                  <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="text-xl sm:text-2xl md:text-3xl opacity-40 hover:opacity-100 transition disabled:opacity-0 hover:text-yellow-400">－</button>
                  <div className="flex items-center">
                    <span className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-500 mr-1 sm:mr-2">$</span>
                    <input 
                      type="number" 
                      value={bet} 
                      onChange={(e) => setBet(parseInt(e.target.value) || 0)}
                      disabled={spinning}
                      className="bg-transparent text-xl sm:text-2xl md:text-3xl font-bold text-center w-16 sm:w-20 md:w-24 focus:outline-none text-yellow-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button onClick={() => setBet(bet + 10)} disabled={spinning} className="text-xl sm:text-2xl md:text-3xl opacity-40 hover:opacity-100 transition disabled:opacity-0 hover:text-yellow-400">＋</button>
                </div>
              </div>

              <button 
                onClick={startSpin}
                disabled={spinning}
                className={`w-full py-4 sm:py-5 md:py-6 rounded-full font-black text-base sm:text-lg md:text-xl tracking-[0.15em] md:tracking-[0.2em] uppercase transition-all duration-300 ${spinning ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 shadow-[0_0_30px_rgba(218,165,32,0.5)] hover:scale-105 active:scale-95'}`}
              >
                {spinning ? 'กำลังหมุน...' : '🎰 หมุนเลย !'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`w-full max-w-sm sm:max-w-md bg-[#0a0a0a]/95 border-2 p-8 sm:p-12 md:p-16 rounded-3xl sm:rounded-[4rem] text-center shadow-[0_0_100px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-20 duration-500 ${winData.amount > 0 ? 'border-yellow-500/50' : 'border-red-900/50'}`}>
            <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black uppercase font-['Fahkwang'] mb-4 sm:mb-6 ${winData.amount > 0 ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]' : 'text-red-600'}`}>
              {winData.amount > 0 ? 'ยินดีด้วย !' : 'เสียใจด้วย'}
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-[#a0b1c3] mb-8 sm:mb-10 leading-relaxed">
              {winData.amount > 0 
                ? `ได้รางวัล ${winData.label} 🎉\n$ ${winData.amount.toLocaleString()}` 
                : 'ลองใหม่อีกครั้งนะ 🍀'}
            </p>
            <button 
              onClick={() => setShowWinModal(false)}
              className="w-full py-4 sm:py-5 md:py-6 bg-white text-black font-bold rounded-full text-xs sm:text-sm uppercase tracking-wider md:tracking-widest hover:bg-yellow-500 transition-colors shadow-lg"
            >
              เล่นต่อ ! 🎲
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
