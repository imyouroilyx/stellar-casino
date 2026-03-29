// src/app/games/pokdeng/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

const SUITS = ['♠', '♥', '♦', '♣']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

type Card = { suit: string; value: string; score: number }
type GameMode = 'SELECT' | 'SINGLE'

export default function PokDengHome() {
  const [mode, setMode] = useState<GameMode>('SELECT')

  if (mode === 'SINGLE') return <PokDengSingle onBack={() => setMode('SELECT')} />

  return (
    <div
      className="flex min-h-screen w-full bg-[#0a0f16] text-white overflow-hidden items-center justify-center"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}
    >
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .float-anim { animation: float 3s ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #fbbf24, #fef08a, #fbbf24, #f59e0b);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div className="flex flex-col items-center gap-10 p-8 max-w-lg w-full">
        {/* Logo */}
        <div className="text-center float-anim">
          <div className="text-7xl mb-2">🃏</div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter shimmer-text drop-shadow-lg">Stellar Poker</h1>
          <p className="text-gray-400 font-bold mt-2 tracking-widest text-sm uppercase">ป๊อกเด้ง — เลือกโหมดการเล่น</p>
        </div>

        {/* Mode Cards */}
        <div className="flex flex-col gap-4 w-full">
          {/* Single Player */}
          <button
            onClick={() => setMode('SINGLE')}
            className="group relative w-full p-6 rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/30 to-black/60 hover:border-yellow-400/60 hover:from-yellow-800/40 transition-all duration-300 text-left overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4">
              <span className="text-4xl">🤖</span>
              <div>
                <h2 className="text-2xl font-black text-yellow-400 uppercase tracking-tight">Single Player</h2>
                <p className="text-gray-400 text-sm font-bold mt-0.5">เล่นคนเดียวกับ AI เจ้ามือ</p>
              </div>
              <span className="ml-auto text-yellow-500/50 text-3xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </button>

          {/* Multiplayer */}
          <Link
            href="/games/pokdeng/multiplayer"
            className="group relative w-full p-6 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-black/60 hover:border-purple-400/60 hover:from-purple-800/40 transition-all duration-300 text-left overflow-hidden block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4">
              <span className="text-4xl">👥</span>
              <div>
                <h2 className="text-2xl font-black text-purple-400 uppercase tracking-tight">Multiplayer</h2>
                <p className="text-gray-400 text-sm font-bold mt-0.5">เล่นกับผู้เล่นคนอื่นในห้อง</p>
              </div>
              <span className="ml-auto text-purple-500/50 text-3xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/30">Realtime</span>
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-bold border border-green-500/30">สูงสุด 6 คน</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Single Player Component ───────────────────────────────────────────────────
function PokDengSingle({ onBack }: { onBack: () => void }) {
  const { profile, syncUser } = useUser()
  const [bet, setBet] = useState(10)
  const [gameState, setGameState] = useState<'IDLE' | 'SHUFFLING' | 'DEALING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'RESULT'>('IDLE')
  const [playerCards, setPlayerCards] = useState<Card[]>([])
  const [dealerCards, setDealerCards] = useState<Card[]>([])
  const [isDealerShow, setIsDealerShow] = useState(false)
  const [resultMsg, setResultMsg] = useState({ text: '', color: '' })

  const flipSnd = useRef<HTMLAudioElement | null>(null)
  const shuffleSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd = useRef<HTMLAudioElement | null>(null)
  const loseSnd = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    flipSnd.current = new Audio('/sounds/Card-flip.wav')
    shuffleSnd.current = new Audio('/sounds/Card-shuffle.wav')
    winSnd.current = new Audio('/sounds/Win.wav')
    loseSnd.current = new Audio('/sounds/Lose.wav')
  }, [])

  const playEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) { audio.current.currentTime = 0; audio.current.play().catch(() => {}) }
  }

  const drawCard = (): Card => {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
    const value = VALUES[Math.floor(Math.random() * VALUES.length)]
    const score = (value === 'A') ? 1 : (['10', 'J', 'Q', 'K'].includes(value)) ? 0 : parseInt(value)
    return { suit, value, score }
  }

  const calculateScore = (cards: Card[]) => cards.reduce((sum, c) => sum + c.score, 0) % 10

  const getWinMultiplier = (cards: Card[]) => {
    const res = { mult: 1, name: 'แต้มปกติ' }
    if (cards.length === 2) {
      if (cards[0].suit === cards[1].suit || cards[0].value === cards[1].value) { res.mult = 2; res.name = '2 เด้ง' }
    } else if (cards.length === 3) {
      const values = cards.map(c => c.value).sort()
      if (new Set(values).size === 1) { res.mult = 5; res.name = 'ตอง' }
      else if (new Set(cards.map(c => c.suit)).size === 1) { res.mult = 3; res.name = '3 เด้ง' }
      else if (values.every(v => ['J', 'Q', 'K'].includes(v))) { res.mult = 3; res.name = 'เซียน' }
    }
    return res
  }

  const startGame = async () => {
    if (!profile || profile.balance < bet || bet <= 0) return alert('ยอดเงินไม่พอ!')
    setGameState('SHUFFLING'); setPlayerCards([]); setDealerCards([]); setIsDealerShow(false); setResultMsg({ text: '', color: '' })
    playEffect(shuffleSnd)

    await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
    await syncUser()

    setTimeout(() => {
      setGameState('DEALING')
      const p1 = drawCard(), p2 = drawCard(), d1 = drawCard(), d2 = drawCard()
      setTimeout(() => { setPlayerCards([p1]); playEffect(flipSnd) }, 200)
      setTimeout(() => { setDealerCards([d1]); playEffect(flipSnd) }, 500)
      setTimeout(() => { setPlayerCards([p1, p2]); playEffect(flipSnd) }, 800)
      setTimeout(() => { setDealerCards([d1, d2]); playEffect(flipSnd) }, 1100)
      setTimeout(() => {
        const pScore = calculateScore([p1, p2])
        const dScore = calculateScore([d1, d2])
        if (pScore >= 8 || dScore >= 8) { setIsDealerShow(true); resolveGame([p1, p2], [d1, d2]) }
        else { setGameState('PLAYER_TURN') }
      }, 1600)
    }, 1200)
  }

  const aiDealerTurn = (currentPHand: Card[]) => {
    setGameState('DEALER_TURN')
    const finalDHand = [...dealerCards]
    if (calculateScore(dealerCards) <= 5) {
      setTimeout(() => {
        finalDHand.push(drawCard()); setDealerCards([...finalDHand]); playEffect(flipSnd)
        setTimeout(() => { setIsDealerShow(true); resolveGame(currentPHand, finalDHand) }, 800)
      }, 700)
    } else {
      setTimeout(() => { setIsDealerShow(true); resolveGame(currentPHand, finalDHand) }, 700)
    }
  }

  const resolveGame = async (pHand: Card[], dHand: Card[]) => {
    setGameState('RESULT')
    const pScore = calculateScore(pHand), dScore = calculateScore(dHand)
    const pInfo = getWinMultiplier(pHand)
    let finalWin = 0, msg = '', color = 'text-white'

    if (pScore > dScore) {
      finalWin = bet * (pInfo.mult + 1); msg = `ชนะ! +$${bet * pInfo.mult} (${pInfo.name})`; color = 'text-green-400'; playEffect(winSnd)
    } else if (pScore < dScore) {
      msg = `แพ้ให้เจ้ามือ ${dScore} แต้ม`; color = 'text-red-500'; playEffect(loseSnd)
    } else {
      finalWin = bet; msg = 'เสมอ! (คืนทุน)'; color = 'text-yellow-400'; playEffect(winSnd)
    }

    if (finalWin > 0) {
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      await supabase.from('profiles').update({ balance: (curr?.balance || 0) + finalWin }).eq('id', profile!.id)
    }
    await supabase.from('game_logs').insert([{ user_id: profile!.id, game_name: 'PokDeng', change_amount: finalWin > 0 ? finalWin - bet : -bet, result: msg }])
    syncUser()
    setResultMsg({ text: msg, color })
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0a0f16] text-white font-['Google_Sans'] overflow-y-auto overflow-x-hidden scrollbar-hide"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
      <style>{`
        @keyframes deal { from { transform: translateY(-50vh) rotate(180deg); opacity: 0; } to { transform: translateY(0) rotate(0deg); opacity: 1; } }
        .card-anim { animation: deal 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-8 items-start justify-center max-w-[1400px] mx-auto">
        <div className="flex-1 w-full flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
              ← กลับ
            </button>
            <h1 className="text-5xl md:text-6xl font-black italic text-center flex-1 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 uppercase tracking-tighter drop-shadow-lg">
              Stellar Poker
            </h1>
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-black border border-yellow-500/30">SOLO</span>
          </div>

          {/* Card Board */}
          <div className="bg-black/60 rounded-[3rem] md:rounded-[4rem] border border-white/10 backdrop-blur-md p-6 md:p-10 min-h-[450px] flex flex-col justify-around shadow-2xl relative">
            {/* Dealer */}
            <div className="flex flex-col items-center">
              <div className="flex gap-3 md:gap-4 h-32 md:h-40">
                {dealerCards.map((c, i) => (
                  <div key={i} className={`w-24 md:w-28 h-32 md:h-40 rounded-xl flex items-center justify-center text-3xl md:text-5xl font-bold border-2 card-anim ${isDealerShow ? 'bg-white text-black' : 'bg-purple-900 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'}`}>
                    {isDealerShow ? <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-500' : ''}>{c.value}{c.suit}</span> : '★'}
                  </div>
                ))}
                {dealerCards.length === 0 && <div className="w-24 md:w-28 h-32 md:h-40 border-2 border-white/5 rounded-xl bg-black/20" />}
              </div>
              <p className="mt-4 text-xs font-black text-gray-500 uppercase tracking-widest">เจ้ามือ AI {isDealerShow && `(${calculateScore(dealerCards)} แต้ม)`}</p>
            </div>

            <div className="w-full h-[1px] bg-white/5 my-4" />

            {/* Player */}
            <div className="flex flex-col items-center">
              <div className="flex gap-3 md:gap-4 h-32 md:h-40">
                {playerCards.map((c, i) => (
                  <div key={i} className="w-24 md:w-28 h-32 md:h-40 bg-white text-black rounded-xl flex items-center justify-center text-3xl md:text-5xl font-bold border-4 border-yellow-500 card-anim shadow-[0_0_25px_rgba(234,179,8,0.2)]">
                    <span className={c.suit === '♥' || c.suit === '♦' ? 'text-red-500' : ''}>{c.value}{c.suit}</span>
                  </div>
                ))}
                {playerCards.length === 0 && <div className="w-24 md:w-28 h-32 md:h-40 border-2 border-white/5 rounded-xl bg-black/20" />}
              </div>
              <div className="mt-6 px-10 py-2 bg-yellow-600/20 rounded-full font-black italic text-lg md:text-xl border border-yellow-500/50 text-white shadow-inner">
                แต้มของคุณ: {playerCards.length > 0 ? calculateScore(playerCards) : '0'}
              </div>
            </div>

            {gameState === 'RESULT' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <div className={`text-4xl md:text-6xl font-black animate-bounce uppercase tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] ${resultMsg.color}`}>
                  {resultMsg.text}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-black/90 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl mb-10">
            {gameState === 'IDLE' || gameState === 'RESULT' ? (
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center px-4 md:px-8 py-3 md:py-4 bg-white/5 rounded-3xl border border-white/10 shadow-inner">
                  <span className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest">เดิมพันสะสม</span>
                  <span className="text-3xl md:text-4xl font-black text-yellow-500">${bet}</span>
                </div>
                <div className="flex gap-2">
                  {[10, 100, 500, 1000].map(v => (
                    <button key={v} onClick={() => setBet(Math.min(bet + v, 1000))} className="flex-1 py-3 md:py-4 bg-white/5 rounded-2xl font-black text-base md:text-lg hover:bg-yellow-500 hover:text-black transition-all">+{v}</button>
                  ))}
                  <button onClick={() => setBet(10)} className="flex-1 py-3 md:py-4 bg-red-900/30 text-red-400 rounded-2xl font-black">RESET</button>
                </div>
                <button onClick={startGame} className="w-full py-5 md:py-6 bg-white text-black font-black rounded-full text-xl md:text-2xl hover:bg-yellow-500 shadow-xl transition-transform active:scale-95">
                  เริ่มแจกไพ่!
                </button>
              </div>
            ) : gameState === 'PLAYER_TURN' ? (
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                <button
                  onClick={() => { const c = drawCard(); const n = [...playerCards, c]; setPlayerCards(n); playEffect(flipSnd); aiDealerTurn(n) }}
                  disabled={playerCards.length >= 3}
                  className="py-6 md:py-8 bg-purple-600 text-white font-black rounded-3xl text-2xl md:text-3xl shadow-xl hover:bg-purple-500 transition-all active:scale-95 disabled:opacity-30"
                >
                  จั่วไพ่เพิ่ม
                </button>
                <button onClick={() => aiDealerTurn(playerCards)} className="py-6 md:py-8 bg-gray-800 text-white font-black rounded-3xl text-2xl md:text-3xl shadow-xl hover:bg-gray-700 active:scale-95">
                  พอแล้ว
                </button>
              </div>
            ) : (
              <div className="py-10 md:py-12 text-center animate-pulse text-gray-600 font-black uppercase text-xl md:text-2xl tracking-[0.2em]">
                {gameState === 'SHUFFLING' ? 'กำลังสับไพ่...' : 'กำลังแจกไพ่...'}
              </div>
            )}
          </div>
        </div>

        {/* Rules Sidebar */}
        <div className="w-full lg:w-80 bg-black/85 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-white/10 flex flex-col justify-between shadow-2xl h-fit lg:sticky lg:top-8 shrink-0 mb-10 overflow-hidden">
          <div className="space-y-6">
            <h3 className="text-yellow-500 font-black italic text-xl md:text-2xl border-b-2 border-white/10 pb-3 uppercase tracking-widest text-center">กติกาการเล่น</h3>
            <div className="space-y-4 text-[13px] md:text-[14px] leading-relaxed text-gray-300 font-bold">
              <p><span className="text-yellow-500">• วิธีเล่น:</span> วัดแต้มกับเจ้ามือ ใครใกล้ 9 ที่สุดชนะ</p>
              <p><span className="text-yellow-500">• ป๊อก 8-9:</span> ชนะทันทีเมื่อได้ไพ่ 2 ใบแรก</p>
              <p><span className="text-yellow-500">• 2 เด้ง:</span> ดอกหรือเลขเดียวกัน (จ่าย x2)</p>
              <p><span className="text-yellow-500">• 3 เด้ง:</span> ดอกเดียวกัน 3 ใบ (จ่าย x3)</p>
              <p><span className="text-yellow-500">• เซียน/ตอง:</span> กลุ่ม JQK หรือเลขเดียวกัน (จ่าย x3-x5)</p>
            </div>
          </div>
          <div className="space-y-4 pt-8 mt-6 border-t border-white/10 text-center text-sm">
            <div className="flex justify-between font-black"><span>ปกติ / เสมอ</span><span className="text-yellow-500">x1</span></div>
            <div className="flex justify-between font-black"><span>2 เด้ง</span><span className="text-yellow-500">x2</span></div>
            <div className="flex justify-between font-black"><span>3 เด้ง/เซียน</span><span className="text-yellow-500">x3</span></div>
            <div className="flex justify-between font-black pt-2 border-t border-white/5"><span>ไพ่ตอง</span><span className="text-yellow-500 text-2xl font-black">x5</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
