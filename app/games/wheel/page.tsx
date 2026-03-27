// src/app/games/wheel/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

// ✅ เพิ่มเป็น 20 ช่อง โดยมี JACKPOT แค่ 2 ช่อง
const PRIZES = [
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x2', multiplier: 2, color: '#1E3A8A' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x1', multiplier: 1, color: '#1E3A8A' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'JACKPOT', multiplier: 50, color: '#D97706' }, // 🏆 Jackpot 1
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x5', multiplier: 5, color: '#6D28D9' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x2', multiplier: 2, color: '#1E3A8A' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x10', multiplier: 10, color: '#DB2777' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x1', multiplier: 1, color: '#1E3A8A' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'JACKPOT', multiplier: 50, color: '#D97706' }, // 🏆 Jackpot 2
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x3', multiplier: 3, color: '#4F46E5' },
  { label: 'x0', multiplier: 0, color: '#0A0F24' },
  { label: 'x1', multiplier: 1, color: '#1E3A8A' }
]

export default function LuckyWheel() {
  const { profile, syncUser } = useUser()
  const [bet, setBet] = useState(10)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [showWinModal, setShowWinModal] = useState(false)
  const [winData, setWinData] = useState({ amount: 0, label: '' })

  const spinSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd = useRef<HTMLAudioElement | null>(null)
  const loseSnd = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    spinSnd.current = new Audio('/sounds/Wheelspin.wav')
    winSnd.current = new Audio('/sounds/Win.wav')
    loseSnd.current = new Audio('/sounds/Lose.wav')
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
    playEffect(spinSnd)

    try {
      await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
      await syncUser()

      const prizeIndex = Math.floor(Math.random() * PRIZES.length)
      const prize = PRIZES[prizeIndex]
      
      const segmentDeg = 360 / PRIZES.length
      
      // ✅ คำนวณให้หยุดที่ตำแหน่งลูกศรทางซ้าย (270 องศา) สำหรับ 20 ช่อง
      const targetDeg = 270 - (prizeIndex * segmentDeg) - (segmentDeg / 2)
      const extraRounds = 360 * 12 // เพิ่มรอบหมุนให้ดูเร็วขึ้นสำหรับวงล้อละเอียด
      const newRotation = rotation + extraRounds + (targetDeg - (rotation % 360))
      
      setRotation(newRotation)

      setTimeout(async () => {
        setSpinning(false)
        if (spinSnd.current) {
          spinSnd.current.pause()
          spinSnd.current.currentTime = 0
        }

        const winAmount = Math.floor(bet * prize.multiplier)
        setWinData({ amount: winAmount, label: prize.label })

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
          result: `ได้รางวัล ${prize.label}`
        }])

        setShowWinModal(true)
        syncUser()
      }, 5000)

    } catch (err) {
      setSpinning(false)
    }
  }

  return (
    <div 
      className="min-h-screen text-white flex flex-col items-center justify-center p-6 bg-cover bg-center overflow-hidden font-['Google_Sans']"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      <div className="z-10 flex flex-col items-center space-y-12 max-w-2xl w-full">
        
        <div className="text-center">
          <h1 className="font-['Fahkwang'] text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-lg">
            STELLAR WHEEL
          </h1>
          <p className="text-2xl font-bold text-[#a0b1c3] uppercase tracking-[0.2em] mt-2">หมุนลุ้นโชคแห่งดวงดาว</p>
        </div>

        <div className="relative flex items-center">
          {/* ✅ ลูกศรทางซ้าย ➽ */}
          <div className="absolute left-[-60px] md:left-[-90px] z-30 text-6xl md:text-8xl text-yellow-500 drop-shadow-[0_0_20px_rgba(255,215,0,0.7)] animate-pulse">
            ➽
          </div>

          {/* Wheel Board */}
          <div className="w-80 h-80 md:w-[550px] md:h-[550px] rounded-full border-[14px] border-yellow-900/40 relative shadow-[0_0_120px_rgba(0,0,0,0.9)] bg-black/80 backdrop-blur-sm">
            
            <div 
              className="w-full h-full rounded-full relative transition-transform duration-[5000ms] cubic-bezier(0.1, 0, 0.1, 1)"
              style={{ 
                transform: `rotate(${rotation}deg)`,
                background: `conic-gradient(${PRIZES.map((p, i) => `${p.color} ${i * (100 / PRIZES.length)}% ${(i + 1) * (100 / PRIZES.length)}%`).join(', ')})`
              }}
            >
              {PRIZES.map((p, i) => (
                <div 
                  key={i}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-full flex items-start pt-6 md:pt-10 font-black text-[8px] md:text-[14px] text-white/90"
                  style={{ transform: `rotate(${i * (360 / PRIZES.length) + (360 / PRIZES.length / 2)}deg)` }}
                >
                  <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase -rotate-0">{p.label}</span>
                </div>
              ))}
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 md:w-28 md:h-28 bg-gradient-to-br from-yellow-700 to-black rounded-full border-4 border-yellow-500 shadow-2xl flex items-center justify-center z-20">
              <div className="w-5 h-5 bg-white rounded-full shadow-[0_0_20px_white] animate-ping"></div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md bg-black/80 border border-white/10 p-8 rounded-[3rem] shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-8 px-4">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bet Amount</span>
            <div className="flex items-center space-x-6">
              <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="text-2xl opacity-40 hover:opacity-100 transition disabled:opacity-0">－</button>
              <div className="flex items-center">
                <span className="text-4xl font-bold text-yellow-500 mr-2">$</span>
                <input 
                  type="number" 
                  value={bet} 
                  onChange={(e) => setBet(parseInt(e.target.value) || 0)}
                  disabled={spinning}
                  className="bg-transparent text-4xl font-bold text-center w-28 focus:outline-none text-yellow-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <button onClick={() => setBet(bet + 10)} disabled={spinning} className="text-2xl opacity-40 hover:opacity-100 transition disabled:opacity-0">＋</button>
            </div>
          </div>

          <button 
            onClick={startSpin}
            disabled={spinning}
            className={`w-full py-7 rounded-full font-black text-xl tracking-[0.2em] uppercase transition-all duration-300 ${spinning ? 'bg-gray-900 text-gray-700' : 'bg-white text-black hover:bg-yellow-500 shadow-2xl scale-100 active:scale-95'}`}
          >
            {spinning ? 'กำลังหมุน...' : 'เสี่ยงโชคเลย !'}
          </button>
        </div>
      </div>

      {showWinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className={`w-full max-w-md bg-[#0a0a0a]/95 border-2 p-16 rounded-[4rem] text-center shadow-2xl animate-in slide-in-from-bottom-20 duration-500 ${winData.amount > 0 ? 'border-yellow-500/50' : 'border-red-900/50'}`}>
            <h2 className={`text-5xl font-black uppercase font-['Fahkwang'] mb-8 ${winData.amount > 0 ? 'text-green-500' : 'text-red-600'}`}>
              {winData.amount > 0 ? 'ยินดีด้วย !' : 'แพ้ซะแล้ว'}
            </h2>
            <p className="text-2xl font-bold text-[#a0b1c3] mb-12 leading-relaxed">
              {winData.amount > 0 
                ? `รับรางวัล ${winData.label} ($ ${winData.amount.toLocaleString()})` 
                : 'เสียใจด้วยนะ ลองใหม่อีกครั้งจ้า'}
            </p>
            <button 
              onClick={() => setShowWinModal(false)}
              className="w-full py-6 bg-white text-black font-bold rounded-full text-sm uppercase tracking-widest hover:bg-yellow-500 transition-colors"
            >
              เล่นต่อเลย !
            </button>
          </div>
        </div>
      )}
    </div>
  )
}