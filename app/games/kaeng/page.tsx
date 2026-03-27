// src/app/games/kaeng/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import {
  Card, makeCard, calcScore, getHandBonus,
  resolveVsOpponent, isKaao, isPaet, aiShouldDraw, isRed,
} from './kaengLib'

// ─── Card UI ──────────────────────────────────────────────────────────────────
function CardUI({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  const base = 'w-[68px] h-[96px] rounded-xl flex items-center justify-center font-black text-2xl border-2 card-deal shrink-0'
  if (!card || hidden)
    return <div className={`${base} border-purple-500/40 bg-[#1a0a2e] text-purple-400`}>★</div>
  return (
    <div className={`${base} bg-white border-yellow-400/60 shadow-lg`}>
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}

type Phase = 'IDLE' | 'DEALING' | 'PLAYER_TURN' | 'AI_TURN' | 'RESULT'

export default function KaengSingle() {
  const { profile, syncUser } = useUser()
  const [phase,   setPhase]   = useState<Phase>('IDLE')
  const [bet,     setBet]     = useState(10)
  const [pCards,  setPCards]  = useState<Card[]>([])
  const [aiCards, setAiCards] = useState<Card[]>([])
  const [showAI,  setShowAI]  = useState(false)
  const [result,  setResult]  = useState({ text: '', color: '' })

  const sfx = useRef<Record<string, HTMLAudioElement>>({})
  useEffect(() => {
    sfx.current.flip    = new Audio('/sounds/Card-flip.wav')
    sfx.current.shuffle = new Audio('/sounds/Card-shuffle.wav')
    sfx.current.win     = new Audio('/sounds/Win.wav')
    sfx.current.lose    = new Audio('/sounds/Lose.wav')
  }, [])
  const play = (k: string) => { const a = sfx.current[k]; if (a) { a.currentTime = 0; a.play().catch(() => {}) } }

  const startGame = async () => {
    if (!profile || profile.balance < bet || bet <= 0) return alert('ยอดเงินไม่พอ!')
    setPhase('DEALING')
    setPCards([]); setAiCards([]); setShowAI(false); setResult({ text: '', color: '' })
    play('shuffle')

    await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
    await syncUser()

    const p1 = makeCard(), p2 = makeCard(), a1 = makeCard(), a2 = makeCard()
    setTimeout(() => { setPCards([p1]);       play('flip') }, 300)
    setTimeout(() => { setAiCards([a1]);      play('flip') }, 600)
    setTimeout(() => { setPCards([p1, p2]);   play('flip') }, 900)
    setTimeout(() => { setAiCards([a1, a2]);  play('flip') }, 1200)

    setTimeout(() => {
      // ก้าว/แปด → จบทันที
      if (isKaao([p1,p2]) || isKaao([a1,a2]) || isPaet([p1,p2]) || isPaet([a1,a2])) {
        setShowAI(true)
        doResolve([p1,p2], [a1,a2])
      } else {
        setPhase('PLAYER_TURN')
      }
    }, 1700)
  }

  const playerDraw = () => {
    if (pCards.length >= 3) return
    const c = makeCard(); play('flip')
    const next = [...pCards, c]
    setPCards(next)
    setTimeout(() => doAiTurn(next), 400)
  }

  const playerStand = () => doAiTurn(pCards)

  const doAiTurn = (myCards: Card[]) => {
    setPhase('AI_TURN'); setShowAI(true)
    let finalAi = [...aiCards]
    if (aiShouldDraw(aiCards)) {
      setTimeout(() => {
        const c = makeCard(); play('flip')
        finalAi = [...aiCards, c]; setAiCards(finalAi)
        setTimeout(() => doResolve(myCards, finalAi), 600)
      }, 700)
    } else {
      setTimeout(() => doResolve(myCards, finalAi), 700)
    }
  }

  const doResolve = async (myCards: Card[], aiC: Card[]) => {
    setPhase('RESULT')
    const { result, mult, label } = resolveVsOpponent(myCards, aiC)
    let finalWin = 0, text = '', color = ''

    if (result === 'WIN') {
      finalWin = bet * (mult + 1)
      text  = `ชนะ! +$${bet * mult}${label ? ` (${label})` : ''}`
      color = 'text-green-400'; play('win')
    } else if (result === 'LOSE') {
      text  = `แพ้ ${calcScore(aiC)} แต้ม${label ? ` (${label})` : ''}`
      color = 'text-red-400'; play('lose')
    } else {
      finalWin = bet; text = 'เสมอ — คืนทุน'; color = 'text-yellow-400'
    }

    if (finalWin > 0) {
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      await supabase.from('profiles').update({ balance: (curr?.balance ?? 0) + finalWin }).eq('id', profile!.id)
    }
    await supabase.from('game_logs').insert([{
      user_id: profile!.id, game_name: 'Kaeng',
      change_amount: finalWin > 0 ? finalWin - bet : -bet,
      result: text,
    }])
    syncUser()
    setResult({ text, color })
  }

  const pScore = pCards.length > 0 ? calcScore(pCards) : null
  const aScore = aiCards.length > 0 && showAI ? calcScore(aiCards) : null
  const { label: pBonus } = pCards.length >= 2 ? getHandBonus(pCards) : { label: '' }

  return (
    <div className="flex min-h-screen w-full bg-[#080b12] text-white font-['Google_Sans'] overflow-y-auto"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>
      <style>{`
        @keyframes cardDeal {
          from { opacity:0; transform:translateY(-60px) rotate(-15deg) scale(.8) }
          to   { opacity:1; transform:translateY(0) rotate(0) scale(1) }
        }
        .card-deal { animation: cardDeal .38s cubic-bezier(.22,1,.36,1) both }
        @keyframes pop { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        .pop { animation: pop .5s ease }
      `}</style>

      <div className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-6 items-start justify-center max-w-[1200px] mx-auto">

        {/* Board */}
        <div className="flex-1 w-full flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Link href="/games/kaeng/select"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-400 text-sm font-bold">
              ← กลับ
            </Link>
            <h1 className="flex-1 text-center text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600">
              ไพ่แคง
            </h1>
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-black border border-yellow-500/30">SOLO</span>
          </div>

          {/* Game board */}
          <div className="bg-black/60 backdrop-blur-md rounded-3xl border border-white/8 p-6 md:p-10 flex flex-col gap-8 min-h-[360px] justify-around relative shadow-2xl">

            {/* AI */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest">
                AI เจ้ามือ {aScore !== null ? `· ${aScore} แต้ม` : ''}
              </p>
              <div className="flex gap-3">
                {aiCards.length === 0
                  ? <div className="w-[68px] h-[96px] rounded-xl border border-white/5 bg-black/20" />
                  : aiCards.map((c, i) => <CardUI key={i} card={c} hidden={!showAI} />)
                }
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Player */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                {pCards.length === 0
                  ? <div className="w-[68px] h-[96px] rounded-xl border border-white/5 bg-black/20" />
                  : pCards.map((c, i) => <CardUI key={i} card={c} />)
                }
              </div>
              {pScore !== null && (
                <span className="text-xs font-black px-3 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  {pScore} แต้ม{pBonus ? ` · ${pBonus}` : ''}
                </span>
              )}
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest">ไพ่ของคุณ</p>
            </div>

            {/* Result overlay */}
            {phase === 'RESULT' && result.text && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-3xl pointer-events-none">
                <p className={`text-3xl md:text-5xl font-black pop drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] ${result.color}`}>
                  {result.text}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-black/85 rounded-3xl border border-white/8 p-5 md:p-7 shadow-2xl">

            {(phase === 'IDLE' || phase === 'RESULT') && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-5 py-3 bg-white/5 rounded-2xl border border-white/8">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">เดิมพัน</span>
                  <span className="text-3xl font-black text-yellow-400">${bet}</span>
                </div>
                <div className="flex gap-2">
                  {[10,100,500,1000].map(v => (
                    <button key={v} onClick={() => setBet(b => b + v)}
                      className="flex-1 py-3 bg-white/5 rounded-xl font-black text-sm hover:bg-yellow-500 hover:text-black transition">
                      +{v}
                    </button>
                  ))}
                  <button onClick={() => setBet(10)} className="px-4 py-3 bg-red-900/30 text-red-400 rounded-xl font-black text-sm">↺</button>
                </div>
                <button onClick={startGame}
                  className="w-full py-5 bg-white hover:bg-yellow-400 text-black font-black rounded-full text-xl transition active:scale-95 shadow-xl">
                  🃏 แจกไพ่!
                </button>
              </div>
            )}

            {phase === 'PLAYER_TURN' && (
              <div className="flex flex-col gap-4">
                <p className="text-center text-xs text-yellow-400 font-black uppercase tracking-wider animate-pulse">⭐ ตาของคุณ — จั่วหรือหยุด?</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={playerDraw} disabled={pCards.length >= 3}
                    className="py-5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-2xl text-xl transition active:scale-95 disabled:opacity-30">
                    🃏 จั่วไพ่
                  </button>
                  <button onClick={playerStand}
                    className="py-5 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-2xl text-xl transition active:scale-95">
                    ✋ พอแล้ว
                  </button>
                </div>
              </div>
            )}

            {(phase === 'DEALING' || phase === 'AI_TURN') && (
              <p className="text-center py-6 text-gray-600 font-black uppercase tracking-[.2em] animate-pulse">
                {phase === 'DEALING' ? 'กำลังแจกไพ่...' : 'AI กำลังตัดสิน...'}
              </p>
            )}
          </div>
        </div>

        {/* Rules sidebar */}
        <div className="w-full lg:w-72 bg-black/80 backdrop-blur-xl p-6 rounded-3xl border border-white/8 flex flex-col gap-5 lg:sticky lg:top-6 shadow-2xl">
          <h3 className="text-yellow-500 font-black italic text-xl uppercase tracking-widest border-b border-white/8 pb-3">กติกา</h3>
          <div className="space-y-3 text-[13px] text-gray-400 font-bold leading-relaxed">
            <p><span className="text-yellow-500">• วิธีเล่น:</span> วัดแต้มกับ AI ใครใกล้ 9 ชนะ</p>
            <p><span className="text-yellow-500">• ก้าว (9 แต้ม):</span> ชนะทันทีจาก 2 ใบแรก</p>
            <p><span className="text-yellow-500">• แปด (8 แต้ม):</span> เปิดไพ่วัดกันทันที</p>
            <p><span className="text-yellow-500">• แคง:</span> หน้าเดียวกัน 2 ใบ → ×2</p>
            <p><span className="text-yellow-500">• ดอกเดียว:</span> ดอกเดียวกัน 2 ใบ → ×2</p>
            <p><span className="text-yellow-500">• AI:</span> จั่วเพิ่มถ้า ≤ 5 แต้ม</p>
          </div>
          <div className="border-t border-white/8 pt-4 space-y-2 text-sm">
            <div className="flex justify-between font-black"><span>ปกติ</span><span className="text-yellow-400">×1</span></div>
            <div className="flex justify-between font-black"><span>แคง / ดอกเดียว</span><span className="text-yellow-400">×2</span></div>
          </div>
          <Link href="/games/kaeng/multiplayer"
            className="block text-center py-3 rounded-2xl border border-purple-500/30 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 font-black text-sm transition">
            🏆 เล่น Multiplayer →
          </Link>
        </div>
      </div>
    </div>
  )
}