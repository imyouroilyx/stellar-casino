// src/app/games/fish-prawn-crab/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

const ANIMALS = [
  { id: 'FISH', label: 'ปลา', icon: '🐟', color: 'bg-blue-500/20' },
  { id: 'PRAWN', label: 'กุ้ง', icon: '🦐', color: 'bg-orange-500/20' },
  { id: 'CRAB', label: 'ปู', icon: '🦀', color: 'bg-red-500/20' },
  { id: 'TIGER', label: 'เสือ', icon: '🐯', color: 'bg-yellow-600/20' },
  { id: 'GOURD', label: 'น้ำเต้า', icon: '🍶', color: 'bg-green-600/20' },
  { id: 'ROOSTER', label: 'ไก่', icon: '🐓', color: 'bg-pink-500/20' },
]

export default function FishPrawnCrab() {
  const { profile, syncUser } = useUser()
  const [result, setResult] = useState(['ปลา', 'กุ้ง', 'ปู'])
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

  // ✅ ระบบวางเดิมพัน (เต็งเลขเดียว/สัตว์เดียว)
  const placeBet = (label: string) => {
    if (isRolling) return
    // กดอันใหม่ อันเก่าต้องหาย (Mutual Exclusive)
    setBets({ [label]: (bets[label] || 0) + currentChip })
  }

  const rollDice = async () => {
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0)
    if (totalBet <= 0 || !profile || profile.balance < totalBet) {
      return alert('ยอดเงินไม่พอ หรือยังไม่ได้เลือกเดิมพัน!')
    }

    setIsRolling(true)
    setResultMsg({ text: '', color: '' })
    playEffect(shakeSnd)

    // หักเงินเดิมพันออกจากบัญชีทันที
    await supabase.from('profiles').update({ balance: profile.balance - totalBet }).eq('id', profile.id)
    await syncUser()

    // Animation สุ่มภาพ
    const interval = setInterval(() => {
      setResult([
        ANIMALS[Math.floor(Math.random()*6)].label,
        ANIMALS[Math.floor(Math.random()*6)].label,
        ANIMALS[Math.floor(Math.random()*6)].label
      ])
    }, 100)

    setTimeout(async () => {
      clearInterval(interval)
      stopEffect(shakeSnd) // ✅ หยุดเสียงเขย่าทันทีเมื่อผลออก

      const finalResult = [
        ANIMALS[Math.floor(Math.random()*6)].label,
        ANIMALS[Math.floor(Math.random()*6)].label,
        ANIMALS[Math.floor(Math.random()*6)].label
      ]
      setResult(finalResult)
      setIsRolling(false)
      await calculateResult(finalResult, totalBet)
    }, 2000)
  }

  const calculateResult = async (res: string[], totalInvest: number) => {
    let winAmount = 0
    const betAnimal = Object.keys(bets)[0]
    const betValue = bets[betAnimal]

    if (betAnimal && betValue) {
      const count = res.filter(a => a === betAnimal).length
      if (count > 0) {
        winAmount = betValue + (betValue * count) // คืนทุน + กำไรตามจำนวนตัวที่ออก
      }
    }

    if (winAmount > 0) {
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      await supabase.from('profiles').update({ balance: (curr?.balance || 0) + winAmount }).eq('id', profile!.id)
      setResultMsg({ text: `ชนะ! +$${winAmount}`, color: 'text-green-400' })
      playEffect(winSnd)
    } else {
      setResultMsg({ text: 'แพ้! เสียใจด้วยนะ', color: 'text-red-500' })
      playEffect(loseSnd)
    }

    // บันทึกลง Log
    await supabase.from('game_logs').insert([{
      user_id: profile!.id,
      game_name: 'Fish Prawn Crab',
      change_amount: winAmount > 0 ? winAmount - totalInvest : -totalInvest,
      result: `ออก: ${res.join(', ')}`
    }])
    syncUser()
  }

  return (
    <div className="flex h-screen w-full bg-[#0d1117] text-white font-['Google_Sans'] overflow-hidden select-none">
      
      <div className="flex-1 flex flex-col items-center p-6 relative">
        <h1 className="text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-8 uppercase tracking-tighter">น้ำเต้าปูปลามหาสนุก</h1>

        {/* 🎲 RESULT PANEL */}
        <div className="bg-black/60 border-[10px] border-yellow-900/40 rounded-[4rem] p-10 shadow-2xl backdrop-blur-md flex flex-col items-center gap-6 mb-8 w-full max-w-2xl">
          <div className="flex gap-6">
            {result.map((animalLabel, i) => {
              const animal = ANIMALS.find(a => a.label === animalLabel)
              return (
                <div key={i} className={`w-32 h-32 bg-white rounded-[2.5rem] flex flex-col items-center justify-center shadow-[0_10px_0_#ddd] border-b-8 border-gray-300 ${isRolling ? 'animate-bounce' : ''}`}>
                  <span className="text-6xl">{animal?.icon}</span>
                  <span className="text-black font-black text-sm mt-1">{animal?.label}</span>
                </div>
              )
            })}
          </div>
          <div className="text-2xl font-black text-yellow-500 tracking-[0.4em] uppercase drop-shadow-md">
            {isRolling ? 'กำลังเขย่า...' : 'ผลที่ออก'}
          </div>
        </div>

        {/* 📋 BETTING BOARD */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-3xl flex-1 max-h-[380px]">
          {ANIMALS.map(animal => (
            <div key={animal.id} onClick={() => placeBet(animal.label)} className={`${animal.color} rounded-[3rem] border-2 ${bets[animal.label] ? 'border-yellow-500 scale-105 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'border-white/10'} p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden group`}>
              <span className="text-6xl group-hover:scale-110 transition-transform">{animal.icon}</span>
              <span className="text-xl font-black mt-2 text-gray-300 group-hover:text-white">{animal.label}</span>
              
              {bets[animal.label] && (
                <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center backdrop-blur-[1px]">
                  <div className="bg-yellow-500 text-black px-5 py-1.5 rounded-full font-black text-xl border-2 border-black animate-in zoom-in duration-200 shadow-2xl">
                    ${bets[animal.label]}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 🎛️ CONTROL BOX */}
        <div className="w-full max-w-2xl bg-black/90 p-6 rounded-[3rem] border border-white/10 mt-6 shadow-2xl flex flex-col gap-5">
          {resultMsg.text && <div className={`text-3xl font-black text-center animate-pulse ${resultMsg.color}`}>{resultMsg.text}</div>}
          
          <div className="flex justify-between items-center px-4">
             <div className="flex gap-2">
                {[10, 100, 500, 1000].map(val => (
                  <button key={val} onClick={() => setCurrentChip(val)} className={`px-5 py-2 rounded-xl font-black transition-all ${currentChip === val ? 'bg-yellow-500 text-black scale-110 shadow-lg' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
                    ${val}
                  </button>
                ))}
             </div>
             <button onClick={() => setBets({})} className="text-red-500 font-bold hover:text-red-400 uppercase text-xs tracking-widest transition-colors">ล้างเดิมพัน</button>
          </div>

          <button onClick={rollDice} disabled={isRolling} className="w-full py-5 bg-white text-black font-black rounded-full text-2xl hover:bg-yellow-500 transition-all shadow-xl active:scale-95 disabled:opacity-30">
            {isRolling ? 'กำลังเขย่า...' : 'เริ่มเลอ'}
          </button>
        </div>
      </div>

      {/* 📜 SIDEBAR (No Scroll) */}
      <div className="w-80 bg-black/85 border-l border-white/10 p-10 flex flex-col justify-between shadow-2xl shrink-0">
        <div className="space-y-8">
          <h3 className="text-yellow-500 font-black italic text-3xl border-b-2 border-white/10 pb-4 uppercase tracking-tighter">กติกา</h3>
          <div className="space-y-6 text-lg font-bold text-gray-400">
            <p><span className="text-yellow-500">• วิธีเล่น:</span> เลือกสัตว์ที่ต้องการ 1 ชนิดต่อรอบ</p>
            <p><span className="text-white">• ถูก 1 ตัว:</span> จ่าย 1 เท่า</p>
            <p><span className="text-white">• ถูก 2 ตัว:</span> จ่าย 2 เท่า</p>
            <p><span className="text-white">• ถูก 3 ตัว:</span> จ่าย 3 เท่า</p>
            <p className="text-sm text-gray-600 italic mt-8">* ทุกยอดชนะรวมทุนคืนแล้ว</p>
          </div>
        </div>
        <div className="text-center opacity-10 text-[9px] tracking-[0.6em] font-black uppercase">Stellar Engine v2.1</div>
      </div>
    </div>
  )
}
