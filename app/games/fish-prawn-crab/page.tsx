// src/app/games/fish-prawn-crab/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

const ANIMALS = [
  { id: 'VAMPIRE',   label: 'แวมไพร์', icon: '🧛', color: 'bg-gradient-to-br from-red-950/60    to-black border-red-500/50    hover:border-red-400',    shadow: 'rgba(239,68,68,0.5)'   },
  { id: 'MERMAID',   label: 'เงือก',   icon: '🧜', color: 'bg-gradient-to-br from-cyan-900/60   to-black border-cyan-500/50   hover:border-cyan-400',   shadow: 'rgba(6,182,212,0.5)'   },
  { id: 'BUTTERFLY', label: 'ผีเสื้อ', icon: '🦋', color: 'bg-gradient-to-br from-purple-900/60 to-black border-purple-500/50 hover:border-purple-400', shadow: 'rgba(168,85,247,0.5)' },
  { id: 'WEREWOLF',  label: 'หมาป่า',  icon: '🐺', color: 'bg-gradient-to-br from-slate-800/60  to-black border-slate-500/50  hover:border-slate-300',   shadow: 'rgba(148,163,184,0.5)' },
  { id: 'SWORD',     label: 'มนุษย์',     icon: '⚔️', color: 'bg-gradient-to-br from-yellow-900/60 to-black border-yellow-500/50 hover:border-yellow-400', shadow: 'rgba(234,179,8,0.5)'  },
  { id: 'WITCH',     label: 'แม่มด',   icon: '🧙', color: 'bg-gradient-to-br from-green-900/60  to-black border-green-500/50  hover:border-green-400',  shadow: 'rgba(34,197,94,0.5)'  },
]

export default function HooHeyHow() {
  const { profile, syncUser } = useUser()
  const [result, setResult] = useState(['แวมไพร์', 'เงือก', 'ผีเสื้อ'])
  const [isRolling, setIsRolling] = useState(false)
  const [bets, setBets] = useState<Record<string, number>>({})
  const [currentChip, setCurrentChip] = useState(100)
  const [resultMsg, setResultMsg] = useState({ text: '', color: '' })

  const shakeSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd   = useRef<HTMLAudioElement | null>(null)
  const loseSnd  = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    shakeSnd.current = new Audio('/sounds/Dice.wav')
    winSnd.current   = new Audio('/sounds/Win.wav')
    loseSnd.current  = new Audio('/sounds/Lose.wav')
  }, [])

  const playEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) { audio.current.currentTime = 0; audio.current.play().catch(() => {}) }
  }
  const stopEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) { audio.current.pause(); audio.current.currentTime = 0 }
  }

  const placeBet = (label: string) => {
    if (isRolling) return
    setBets({ [label]: (bets[label] || 0) + currentChip })
  }

  const rollDice = async () => {
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0)
    if (totalBet <= 0 || !profile || profile.balance < totalBet)
      return alert('ยอดเงินไม่พอ หรือยังไม่ได้เลือกเดิมพัน!')

    setIsRolling(true)
    setResultMsg({ text: '', color: '' })
    playEffect(shakeSnd)

    await supabase.from('profiles').update({ balance: profile.balance - totalBet }).eq('id', profile.id)
    await syncUser()

    const interval = setInterval(() => {
      setResult([
        ANIMALS[Math.floor(Math.random() * 6)].label,
        ANIMALS[Math.floor(Math.random() * 6)].label,
        ANIMALS[Math.floor(Math.random() * 6)].label,
      ])
    }, 100)

    setTimeout(async () => {
      clearInterval(interval)
      stopEffect(shakeSnd)
      const finalResult = [
        ANIMALS[Math.floor(Math.random() * 6)].label,
        ANIMALS[Math.floor(Math.random() * 6)].label,
        ANIMALS[Math.floor(Math.random() * 6)].label,
      ]
      setResult(finalResult)
      setIsRolling(false)
      await calculateResult(finalResult, totalBet)
    }, 2000)
  }

  const calculateResult = async (res: string[], totalInvest: number) => {
    let winAmount = 0
    const betAnimal = Object.keys(bets)[0]
    const betValue  = bets[betAnimal]

    if (betAnimal && betValue) {
      const count = res.filter(a => a === betAnimal).length
      if (count > 0) winAmount = betValue + betValue * count
    }

    if (winAmount > 0) {
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      await supabase.from('profiles').update({ balance: (curr?.balance || 0) + winAmount }).eq('id', profile!.id)
      setResultMsg({ text: `ชนะ! +$${winAmount.toLocaleString()}`, color: 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]' })
      playEffect(winSnd)
    } else {
      setResultMsg({ text: 'แพ้! เสียใจด้วยนะ', color: 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' })
      playEffect(loseSnd)
    }

    await supabase.from('game_logs').insert([{
      user_id: profile!.id,
      game_name: 'Hoo Hey How',
      change_amount: winAmount > 0 ? winAmount - totalInvest : -totalInvest,
      result: `ออก: ${res.join(', ')}`,
    }])
    syncUser()
  }

  return (
    <div
      className="flex flex-col lg:flex-row min-h-screen w-full bg-slate-950 text-white font-['Google_Sans'] overflow-x-hidden bg-cover bg-center bg-fixed select-none"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      {/* ── Main Play Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center p-4 md:p-8 lg:p-12 relative overflow-y-auto">

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-6 md:mb-10 uppercase tracking-tighter drop-shadow-lg font-['Fahkwang']">
          เดอะล็อตโต้
        </h1>

        {/* Result Panel */}
        <div className="bg-black/80 border-[4px] md:border-[8px] border-yellow-900/50 rounded-[2rem] md:rounded-[4rem] p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col items-center gap-4 md:gap-8 mb-6 md:mb-10 w-full max-w-2xl relative">
          {isRolling && <div className="absolute inset-0 bg-yellow-500/10 rounded-[2rem] md:rounded-[4rem] animate-pulse" />}

          <div className="flex gap-3 md:gap-6 relative z-10">
            {result.map((label, i) => {
              const animal = ANIMALS.find(a => a.label === label)
              return (
                <div key={i} className={`w-20 h-20 md:w-32 md:h-32 bg-gradient-to-b from-white to-gray-200 rounded-2xl md:rounded-[2.5rem] flex flex-col items-center justify-center shadow-[0_6px_0_#9ca3af] md:shadow-[0_10px_0_#9ca3af] border-b-4 md:border-b-8 border-gray-400 ${isRolling ? 'animate-bounce' : ''}`}>
                  <span className="text-4xl md:text-6xl">{animal?.icon}</span>
                  <span className="text-black font-black text-[10px] md:text-sm mt-1">{animal?.label}</span>
                </div>
              )
            })}
          </div>

          <div className="text-xl md:text-3xl font-black text-yellow-400 tracking-[0.2em] md:tracking-[0.4em] uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10 mt-2">
            {isRolling ? 'กำลังเขย่า...' : 'ผลที่ออก'}
          </div>
        </div>

        {/* Betting Board */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 w-full max-w-3xl flex-1 mb-6">
          {ANIMALS.map(animal => (
            <div
              key={animal.id}
              onClick={() => placeBet(animal.label)}
              className={`${animal.color} rounded-2xl md:rounded-[3rem] border-2 ${bets[animal.label] ? 'border-yellow-400 scale-105' : 'border-white/10'} p-4 flex flex-col items-center justify-center cursor-pointer hover:scale-[1.03] transition-all duration-300 relative overflow-hidden group min-h-[100px] md:min-h-[140px] shadow-lg`}
              style={bets[animal.label] ? { boxShadow: `0 0 25px ${animal.shadow}` } : {}}
            >
              <span className="text-4xl md:text-6xl group-hover:scale-110 transition-transform drop-shadow-md">{animal.icon}</span>
              <span className="text-sm md:text-xl font-black mt-2 text-gray-300 group-hover:text-white drop-shadow-md">{animal.label}</span>

              {bets[animal.label] && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                  <div className="bg-gradient-to-b from-yellow-300 to-yellow-600 text-black px-3 py-1 md:px-5 md:py-1.5 rounded-full font-black text-sm md:text-xl border border-yellow-200 animate-in zoom-in duration-200 shadow-[0_0_15px_rgba(250,204,21,0.8)]">
                    ${bets[animal.label].toLocaleString()}
                  </div>
                </div>
              )}
            </div>
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
                <button key={val} onClick={() => setCurrentChip(val)}
                  className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-black text-sm md:text-base transition-all duration-300 ${currentChip === val ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black scale-110 shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'}`}>
                  ${val}
                </button>
              ))}
            </div>
            <button onClick={() => setBets({})} className="text-red-400 font-bold hover:text-red-300 uppercase text-xs md:text-sm bg-red-950/30 px-4 py-2 rounded-full border border-red-900/50 transition-colors">
              ล้างเดิมพัน
            </button>
          </div>

          <button onClick={rollDice} disabled={isRolling}
            className={`w-full py-4 md:py-6 font-black rounded-full text-xl md:text-2xl tracking-[0.1em] uppercase shadow-2xl transition-all duration-300 active:scale-95 ${isRolling ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 shadow-[0_0_30px_rgba(250,204,21,0.4)]'}`}>
            {isRolling ? 'กำลังเขย่า...' : 'เริ่มเลย !'}
          </button>
        </div>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-80 bg-black/85 lg:border-l border-t lg:border-t-0 border-white/10 p-6 md:p-8 flex flex-col justify-between shadow-2xl shrink-0 backdrop-blur-md z-20">
        <div className="space-y-6 md:space-y-8">
          <h3 className="text-yellow-500 font-black italic text-xl md:text-3xl border-b-2 border-white/10 pb-3 md:pb-4 uppercase tracking-tighter flex items-center gap-2">
            <span>ℹ️</span> กติกา
          </h3>
          <div className="space-y-4 md:space-y-6 text-sm md:text-base font-bold text-gray-400">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-yellow-500 block mb-1">• วิธีเล่น:</span> เลือกสัญลักษณ์ที่ต้องการ 1 ชนิดต่อรอบ
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-white block mb-1">• ถูก 1 ตัว:</span> จ่าย 1 เท่า
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-white block mb-1">• ถูก 2 ตัว:</span> จ่าย 2 เท่า
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="text-white block mb-1">• ถูก 3 ตัว:</span> จ่าย 3 เท่า
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {ANIMALS.map(a => (
                <div key={a.id} className="flex flex-col items-center gap-1 bg-white/5 rounded-xl p-2 border border-white/5">
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-[10px] text-gray-500 font-bold">{a.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] md:text-xs text-gray-500 italic text-center">* ทุกยอดชนะรวมทุนคืนแล้ว</p>
          </div>
        </div>
        <div className="mt-6 md:mt-0 pt-6 md:pt-0 text-center text-gray-600 text-[10px] tracking-[0.4em] font-black uppercase">
          Stellar Engine v2.1
        </div>
      </div>
    </div>
  )
}
