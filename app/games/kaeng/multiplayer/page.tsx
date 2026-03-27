// src/app/games/kaeng/page.tsx
// ไพ่แคง Single Player — ผู้เล่น 1 คน + AI 3 คน
// กติกา: แต้มน้อยสุดชนะ, จั่ว-ทิ้ง, ไหล, แคง, น็อค
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
 
// ─── Game Logic ───────────────────────────────────────────────────────────────
const SUITS  = ['♠','♥','♦','♣'] as const
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const
type Card = { suit:string; value:string; score:number }
 
const makeCard = (): Card => {
  const suit  = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]
  const score = value === 'A' ? 1 : ['J','Q','K'].includes(value) ? 10 : parseInt(value)
  return { suit, value, score }
}
 
// สร้างสำรับไพ่ 52 ใบ แล้วสับ
function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const value of VALUES) {
    const score = value === 'A' ? 1 : ['J','Q','K'].includes(value) ? 10 : parseInt(value)
    deck.push({ suit, value, score })
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}
 
const handScore = (cards: Card[]) => cards.reduce((s, c) => s + c.score, 0)
const isRed = (suit: string) => suit === '♥' || suit === '♦'
 
// เรียงไพ่จากแต้มน้อยไปมาก (ซ้ายไปขวา)
const sortHand = (hand: Card[]): Card[] =>
  [...hand].sort((a, b) => a.score - b.score)
 
// ตรวจว่ามือมีไพ่ที่ค่าเหมือน topDiscard ≥ 2 ใบ (ตบ)
const canSlap = (hand: Card[], top: Card | undefined): boolean => {
  if (!top) return false
  return hand.filter(c => c.value === top.value).length >= 2
}
 
// AI logic: ทิ้งไพ่แต้มสูงสุด
function aiChooseDiscard(hand: Card[]): number {
  let maxIdx = 0
  for (let i = 1; i < hand.length; i++)
    if (hand[i].score > hand[maxIdx].score) maxIdx = i
  return maxIdx
}
 
// AI ตัดสินใจแคง: ถ้าแต้มรวม ≤ 8
const aiShouldDeclare = (hand: Card[]) => handScore(hand) <= 8
 
// ─── Types ────────────────────────────────────────────────────────────────────
const PLAYER_NAMES = ['คุณ', 'AI 2', 'AI 3', 'AI 4']
type Phase = 'IDLE' | 'PLAYING' | 'RESULT'
type EndReason = 'KAENG' | 'KNOCK' | null
 
interface PlayerState {
  name:   string
  hand:   Card[]
  isHuman: boolean
  score:  number  // แต้มรวมมือ (ยิ่งน้อยยิ่งดี)
}
 
// ─── Card UI ──────────────────────────────────────────────────────────────────
function CardUI({ card, hidden=false, highlight=false, small=false, onClick }:
  { card?:Card; hidden?:boolean; highlight?:boolean; small?:boolean; onClick?:()=>void }) {
  const w = small ? 'w-9 h-12 text-xs' : 'w-14 h-20 text-xl'
  const base = `${w} rounded-lg flex items-center justify-center font-black border-2 card-deal shrink-0 select-none`
  if (!card || hidden)
    return <div className={`${base} border-purple-500/40 bg-[#1a0a2e] text-purple-400`}>★</div>
  return (
    <div onClick={onClick}
      className={`${base} bg-white border-2 shadow-md transition-all
        ${highlight ? 'border-yellow-400 shadow-yellow-400/40 shadow-lg -translate-y-2 cursor-pointer' : 'border-gray-200'}
        ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-yellow-300' : ''}
      `}>
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}
 
// ─── Discard pile top card ────────────────────────────────────────────────────
function DiscardTop({ card }: { card?: Card }) {
  if (!card) return <div className="w-14 h-20 rounded-lg border-2 border-white/10 bg-white/5 flex items-center justify-center text-gray-700 text-xs font-bold">กอง<br/>ทิ้ง</div>
  return (
    <div className="w-14 h-20 rounded-lg bg-white border-2 border-white/40 flex items-center justify-center font-black text-xl shadow-lg card-deal">
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}
 
// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KaengSingle() {
  const { profile, syncUser } = useUser()
 
  const [phase,          setPhase]          = useState<Phase>('IDLE')
  const [bet,            setBet]            = useState(10)
  const [players,        setPlayers]        = useState<PlayerState[]>([])
  const [deck,           setDeck]           = useState<Card[]>([])
  const [discardPile,    setDiscardPile]    = useState<Card[]>([])
  const [currentTurn,    setCurrentTurn]    = useState(0)   // index ใน players
  const [selectedCard,   setSelectedCard]   = useState<number|null>(null) // index ในมือ
  const [canFlow,        setCanFlow]        = useState(false) // ไหลได้ไหม
  const [endReason,      setEndReason]      = useState<EndReason>(null)
  const [winnerIdx,      setWinnerIdx]      = useState<number|null>(null)
  const [resultMsg,      setResultMsg]      = useState('')
  const [log,            setLog]            = useState<string[]>([])
  const [isAnimating,    setIsAnimating]    = useState(false)
  const [slapNotice,     setSlapNotice]     = useState('')   // "ตบ!" หรือ "โง่!"
  const [slapTarget,     setSlapTarget]     = useState<string>('')
 
  const deckRef      = useRef<Card[]>([])
  const playersRef   = useRef<PlayerState[]>([])
  const discardRef   = useRef<Card[]>([])
  const turnRef      = useRef(0)
 
  const sfx = useRef<Record<string,HTMLAudioElement>>({})
  useEffect(() => {
    sfx.current.flip    = new Audio('/sounds/Card-flip.wav')
    sfx.current.shuffle = new Audio('/sounds/Card-shuffle.wav')
    sfx.current.win     = new Audio('/sounds/Win.wav')
    sfx.current.lose    = new Audio('/sounds/Lose.wav')
    sfx.current.slap    = new Audio('/sounds/Slap.wav')
    sfx.current.boo     = new Audio('/sounds/Boo.wav')
  }, [])
  const play = (k:string) => { const a=sfx.current[k]; if(a){a.currentTime=0;a.play().catch(()=>{})} }
 
  const addLog = (msg:string) => setLog(prev => [msg, ...prev.slice(0, 19)])
 
  // sync refs
  useEffect(() => { deckRef.current    = deck    }, [deck])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { discardRef.current = discardPile }, [discardPile])
  useEffect(() => { turnRef.current    = currentTurn }, [currentTurn])
 
  // ── Start game ─────────────────────────────────────────────────────────
  const startGame = async () => {
    if (!profile || profile.balance < bet) return alert('ยอดเงินไม่พอ!')
    play('shuffle')
    await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
    await syncUser()
 
    const newDeck = makeDeck()
    // แจก 5 ใบต่อคน
    const newPlayers: PlayerState[] = PLAYER_NAMES.map((name, i) => ({
      name, isHuman: i === 0,
      hand: newDeck.splice(0, 5),
      score: 0,
    }))
    newPlayers.forEach(p => {
      p.hand  = sortHand(p.hand)
      p.score = handScore(p.hand)
    })
 
    setPlayers(newPlayers)
    setDeck(newDeck)
    setDiscardPile([])
    setCurrentTurn(0)
    setSelectedCard(null)
    setCanFlow(false)
    setEndReason(null)
    setWinnerIdx(null)
    setResultMsg('')
    setLog([])
    setPhase('PLAYING')
    addLog('แจกไพ่แล้ว — ตาของคุณ!')
  }
 
  // ── Check flow: ไพ่บนกองทิ้ง ตรงกับไพ่ในมือผู้เล่นไหม ─────────────────
  const checkCanFlow = useCallback((hand: Card[], topDiscard: Card | undefined) => {
    if (!topDiscard) return false
    return hand.some(c => c.value === topDiscard.value)
  }, [])
 
  // ── Update flow/slap state เมื่อ turn เปลี่ยน ───────────────────────────
  useEffect(() => {
    if (phase !== 'PLAYING') return
    const p = players[currentTurn]
    if (!p || !p.isHuman) return
    const top = discardPile[discardPile.length - 1]
    setCanFlow(checkCanFlow(p.hand, top))
    setSelectedCard(null)
  }, [currentTurn, discardPile, players, phase, checkCanFlow])
 
  // ── ตรวจ "โง่" — ถ้า AI ทิ้งไพ่แล้วคนอื่น (ถัดไป) ไหลได้แต่ไม่ไหล ─────
  // จะตรวจหลัง AI ทิ้ง: ถ้า discardPile เปลี่ยน และตาถัดไปเป็น human แต่ไหลได้
  useEffect(() => {
    if (phase !== 'PLAYING' || currentTurn !== 0) return
    const top = discardPile[discardPile.length - 1]
    if (!top) return
    // ถ้าตาล่าสุดไม่ใช่ human ที่เพิ่งทิ้ง (AI ทิ้ง) และ human ไหลได้
    const humanHand = players[0]?.hand ?? []
    if (checkCanFlow(humanHand, top)) {
      // ไม่แสดง "โง่" อัตโนมัติ — แสดงเฉพาะตอนที่ human เลือกจั่วแทนที่จะไหล
    }
  }, [discardPile])
 
  // ── AI turn (เรียกหลัง human action) ────────────────────────────────────
  const doAiTurn = useCallback(async (
    turnIdx: number,
    ps: PlayerState[],
    dk: Card[],
    dp: Card[],
  ): Promise<void> => {
    if (turnIdx === 0) return  // human
    const ai = ps[turnIdx]
    const top = dp[dp.length - 1]
 
    await new Promise(r => setTimeout(r, 700))
 
    // ตรวจไหล / ตบ
    const slapAiCards = top ? ai.hand.filter(c => c.value === top.value) : []
    const isAiSlapping = slapAiCards.length >= 2
    const flowIdx = ai.hand.findIndex(c => c.value === top?.value)
    if (top && flowIdx !== -1) {
      play(isAiSlapping ? 'slap' : 'win')
      const newHand = isAiSlapping
        ? ai.hand.filter(c => c.value !== top.value)
        : ai.hand.filter((_,i) => i !== flowIdx)
      const newDp = isAiSlapping
        ? [...dp, ...slapAiCards]
        : [...dp, ai.hand[flowIdx]]
      const label = isAiSlapping ? `ตบ! ${slapAiCards.length} ใบ` : 'ไหล'
      addLog(`${ai.name} ${label} ${top.value}${top.suit}`)
 
      if (newHand.length === 0) {
        // น็อค!
        const newPs = ps.map((p,i) => i===turnIdx ? {...p, hand:newHand, score:0} : p)
        return endGame(newPs, dk, newDp, turnIdx, 'KNOCK')
      }
 
      const newPs = ps.map((p,i) => i===turnIdx ? {...p, hand:newHand, score:handScore(newHand)} : p)
      setPlayers(newPs); setDiscardPile(newDp)
      // next turn
      const next = (turnIdx + 1) % 4
      setCurrentTurn(next)
      if (next !== 0) {
        setTimeout(() => doAiTurn(next, newPs, dk, newDp), 200)
      }
      return
    }
 
    // จั่วไพ่
    if (dk.length === 0) { endGame(ps, dk, dp, -1, 'KAENG'); return }
    const drawn = dk[0]
    const newDk = dk.slice(1)
    play('flip')
    const newHand = [...ai.hand, drawn]
    addLog(`${ai.name} จั่วไพ่`)
 
    // แคง?
    if (aiShouldDeclare(newHand)) {
      const newPs = ps.map((p,i) => i===turnIdx ? {...p, hand:newHand, score:handScore(newHand)} : p)
      addLog(`${ai.name} ประกาศ แคง! (${handScore(newHand)} แต้ม)`)
      return endGame(newPs, newDk, dp, turnIdx, 'KAENG')
    }
 
    // ทิ้งไพ่แต้มสูงสุด
    const discardIdx = aiChooseDiscard(newHand)
    const discarded  = newHand[discardIdx]
    const finalHand  = newHand.filter((_,i) => i !== discardIdx)
    const newDp2     = [...dp, discarded]
    addLog(`${ai.name} ทิ้ง ${discarded.value}${discarded.suit}`)
    play('flip')
 
    const newPs2 = ps.map((p,i) => i===turnIdx ? {...p, hand:finalHand, score:handScore(finalHand)} : p)
    setPlayers(newPs2); setDeck(newDk); setDiscardPile(newDp2)
 
    const next = (turnIdx + 1) % 4
    setCurrentTurn(next)
    if (next !== 0) {
      setTimeout(() => doAiTurn(next, newPs2, newDk, newDp2), 200)
    }
  }, [])
 
  // ── Human: ไหลไพ่ ─────────────────────────────────────────────────────
  const humanFlow = () => {
    if (!canFlow || isAnimating) return
    const top = discardPile[discardPile.length - 1]
    if (!top) return
    const p = players[0]
    // ตรวจตบ: มีไพ่ค่าเดียวกันในมือ ≥ 2 ใบ → ทิ้งได้ทั้งหมดพร้อมกัน
    const slapCards = p.hand.filter(c => c.value === top.value)
    const isSlapping = slapCards.length >= 2
    const flowIdx = p.hand.findIndex(c => c.value === top.value)
    if (flowIdx === -1) return
 
    setIsAnimating(true)
    // ไหล = Win.wav, ตบ = Slap.wav
    play(isSlapping ? 'slap' : 'win')
    const newHand = isSlapping
      ? p.hand.filter(c => c.value !== top.value)   // ทิ้งทุกใบที่ตรง
      : p.hand.filter((_,i) => i !== flowIdx)
    const newDp = isSlapping
      ? [...discardPile, ...slapCards]
      : [...discardPile, p.hand[flowIdx]]
    const actionLabel = isSlapping ? `ตบ! ${slapCards.length} ใบ` : 'ไหล'
    if (isSlapping) { setSlapNotice('ตบ!'); setTimeout(() => setSlapNotice(''), 1500) }
    addLog(`คุณ ${actionLabel} ${top.value}${top.suit}`)
 
    if (newHand.length === 0) {
      const newPs = players.map((pl,i) => i===0 ? {...pl, hand:newHand, score:0} : pl)
      endGame(newPs, deck, newDp, 0, 'KNOCK')
      return
    }
 
    const newPs = players.map((pl,i) => i===0 ? {...pl, hand:newHand, score:handScore(newHand)} : pl)
    setPlayers(newPs); setDiscardPile(newDp); setCanFlow(false); setIsAnimating(false)
    const next = 1
    setCurrentTurn(next)
    setTimeout(() => doAiTurn(next, newPs, deck, newDp), 200)
  }
 
  // ── Human: จั่วไพ่ ────────────────────────────────────────────────────
  const humanDraw = () => {
    if (isAnimating || currentTurn !== 0) return
    if (deck.length === 0) return endGame(players, deck, discardPile, -1, 'KAENG')
    // ตรวจ "โง่" — จั่วทั้งที่ไหลได้
    if (canFlow) {
      play('boo')
      setSlapNotice('โง่!')
      setTimeout(() => setSlapNotice(''), 2000)
      addLog('⚠️ โง่! คุณจั่วทั้งที่ไหลได้')
    }
    play('flip')
    const drawn  = deck[0]
    const newDk  = deck.slice(1)
    const newHand = [...players[0].hand, drawn]
    const newPs  = players.map((p,i) => i===0 ? {...p, hand:newHand, score:handScore(newHand)} : p)
    // เรียงไพ่ใหม่
    const sortedPs = newPs.map((p,i) => i===0 ? {...p, hand:sortHand(p.hand)} : p)
    setPlayers(sortedPs); setDeck(newDk); setSelectedCard(null)
    addLog(`คุณจั่ว ${drawn.value}${drawn.suit}`)
  }
 
  // ── Human: เลือกไพ่ที่จะทิ้ง ──────────────────────────────────────────
  const humanSelectCard = (idx: number) => {
    if (isAnimating || currentTurn !== 0) return
    // ต้องมีไพ่ 6 ใบ (หลังจั่ว) ถึงจะทิ้งได้
    if (players[0].hand.length !== 6) return
    setSelectedCard(idx === selectedCard ? null : idx)
  }
 
  // ── Human: ทิ้งไพ่ที่เลือก ───────────────────────────────────────────
  const humanDiscard = () => {
    if (selectedCard === null || isAnimating) return
    const p = players[0]
    if (p.hand.length !== 6) return
    play('flip')
    const discarded = p.hand[selectedCard]
    const newHand   = p.hand.filter((_,i) => i !== selectedCard)
    const newDp     = [...discardPile, discarded]
    addLog(`คุณทิ้ง ${discarded.value}${discarded.suit}`)
 
    const newPs = players.map((pl,i) => i===0 ? {...pl, hand:newHand, score:handScore(newHand)} : pl)
    setPlayers(newPs); setDiscardPile(newDp); setSelectedCard(null)
    const next = 1
    setCurrentTurn(next)
    setTimeout(() => doAiTurn(next, newPs, deck, newDp), 200)
  }
 
  // ── Human: ประกาศ แคง ────────────────────────────────────────────────
  const humanDeclareKaeng = () => {
    if (isAnimating || currentTurn !== 0 || players[0].hand.length !== 5) return
    addLog(`คุณประกาศ แคง! (${players[0].score} แต้ม)`)
    endGame(players, deck, discardPile, 0, 'KAENG')
  }
 
  // ── End game ──────────────────────────────────────────────────────────
  const endGame = async (
    ps: PlayerState[], _dk: Card[], _dp: Card[],
    declaredBy: number, reason: EndReason
  ) => {
    setIsAnimating(true)
    setPhase('RESULT')
    setEndReason(reason)
 
    let winner = declaredBy
    if (reason === 'KAENG') {
      // หาคนแต้มน้อยสุด
      let minScore = Infinity
      ps.forEach((p, i) => { if (p.score < minScore) { minScore = p.score; winner = i } })
    }
    // น็อค = ผู้น็อคชนะเลย
    setWinnerIdx(winner)
    setPlayers(ps)
 
    const isPlayerWin = winner === 0
    let finalWin = 0
 
    if (isPlayerWin) {
      // ชนะ = ได้ bet × 3 (จากผู้แพ้ทั้ง 3)
      // น็อค = ×4
      const mult = reason === 'KNOCK' ? 4 : 3
      finalWin = bet * mult + bet  // bet คืน + กำไร
      const msg = reason === 'KNOCK'
        ? `น็อค! 🎉 ได้ +$${bet * mult}`
        : `ชนะ! แต้มน้อยสุด (${ps[0].score}) ได้ +$${bet * mult}`
      setResultMsg(msg)
      play('win')
      const { data:curr } = await supabase.from('profiles').select('balance').eq('id', profile!.id).single()
      await supabase.from('profiles').update({ balance:(curr?.balance??0) + finalWin }).eq('id', profile!.id)
    } else {
      // แพ้
      let msg = ''
      if (reason === 'KNOCK') msg = `${ps[winner].name} น็อค! คุณแพ้ -$${bet}`
      else if (declaredBy === 0) msg = `คุณหงาย! ${ps[winner].name} แต้มน้อยกว่า (${ps[winner].score}) เสีย -$${bet}`
      else msg = `${ps[winner].name} ประกาศแคง (${ps[winner].score} แต้ม) คุณแพ้ -$${bet}`
      setResultMsg(msg)
      play('lose')
    }
 
    await supabase.from('game_logs').insert([{
      user_id: profile!.id, game_name:'Kaeng',
      change_amount: isPlayerWin ? finalWin - bet : -bet,
      result: `${reason === 'KNOCK' ? 'น็อค' : 'แคง'} · ผู้ชนะ: ${ps[winner].name} · แต้ม: ${ps[winner].score}`,
    }])
    syncUser()
    setIsAnimating(false)
  }
 
  const humanP    = players[0]
  const mustDiscard = humanP?.hand.length === 6
  const canDeclare  = humanP?.hand.length === 5 && currentTurn === 0 && phase === 'PLAYING'
 
  return (
    <div className="flex min-h-screen w-full bg-[#080b12] text-white font-['Google_Sans'] overflow-y-auto"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>
      <style>{`
        @keyframes cardDeal { from{opacity:0;transform:translateY(-40px) rotate(-10deg) scale(.85)} to{opacity:1;transform:none} }
        .card-deal { animation: cardDeal .3s cubic-bezier(.22,1,.36,1) both }
        .scr::-webkit-scrollbar{width:3px} .scr::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:9px}
      `}</style>
 
      <div className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-5 max-w-[1400px] mx-auto w-full">
 
        {/* ── Board ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4">
 
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href="/games/kaeng/select" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-400 text-sm font-bold">← กลับ</Link>
            <h1 className="flex-1 text-center text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600">ไพ่แคง</h1>
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-black border border-yellow-500/30">SOLO</span>
          </div>
 
          {phase === 'IDLE' || phase === 'RESULT' ? (
            // ── IDLE / RESULT ──────────────────────────────────────────
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              {phase === 'RESULT' && (
                <div className="bg-black/70 rounded-3xl border border-white/10 p-6 flex flex-col items-center gap-4 w-full max-w-lg">
                  <p className={`text-2xl md:text-3xl font-black text-center ${resultMsg.includes('ชนะ')||resultMsg.includes('น็อค') ? 'text-green-400' : 'text-red-400'}`}>
                    {resultMsg}
                  </p>
                  {/* Show all hands */}
                  <div className="w-full grid grid-cols-2 gap-3">
                    {players.map((p, i) => (
                      <div key={i} className={`p-3 rounded-2xl border ${winnerIdx===i ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-white/8 bg-black/30'}`}>
                        <p className={`text-xs font-black mb-2 ${i===0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {p.name} {winnerIdx===i && '🏆'} — {p.score} แต้ม
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {p.hand.map((c,j) => <CardUI key={j} card={c} small />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
 
              {/* Bet + Start */}
              <div className="bg-black/80 rounded-3xl border border-white/8 p-5 w-full max-w-md flex flex-col gap-4">
                <div className="flex justify-between items-center px-4 py-2.5 bg-white/5 rounded-2xl border border-white/8">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">เดิมพัน</span>
                  <span className="text-2xl font-black text-yellow-400">${bet}</span>
                </div>
                <div className="flex gap-2">
                  {[10,50,100,500].map(v => (
                    <button key={v} onClick={() => setBet(b => b+v)}
                      className="flex-1 py-2.5 bg-white/5 rounded-xl font-black text-sm hover:bg-yellow-500 hover:text-black transition">+{v}</button>
                  ))}
                  <button onClick={() => setBet(10)} className="px-3 py-2.5 bg-red-900/30 text-red-400 rounded-xl font-black text-sm">↺</button>
                </div>
                <button onClick={startGame}
                  className="w-full py-4 bg-white hover:bg-yellow-400 text-black font-black rounded-full text-xl transition active:scale-95">
                  🃏 เริ่มเกม!
                </button>
              </div>
            </div>
 
          ) : (
            // ── PLAYING ────────────────────────────────────────────────
            <div className="flex flex-col gap-4">
 
              {/* AI players (top 3) */}
              <div className="grid grid-cols-3 gap-3">
                {players.slice(1).map((p, i) => {
                  const realIdx = i + 1
                  const isActive = currentTurn === realIdx
                  return (
                    <div key={i} className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all ${isActive ? 'border-purple-500/50 bg-purple-900/10' : 'border-white/8 bg-black/40'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🤖</span>
                        <span className={`text-xs font-black ${isActive ? 'text-purple-300' : 'text-gray-500'}`}>{p.name}</span>
                        {isActive && <span className="ml-auto text-[10px] text-purple-400 animate-pulse font-black">ตา...</span>}
                      </div>
                      {/* ไพ่คว่ำ */}
                      <div className="flex gap-1 flex-wrap">
                        {p.hand.map((_,j) => <CardUI key={j} hidden small />)}
                      </div>
                      <span className="text-[10px] text-gray-700 font-bold">{p.hand.length} ใบ</span>
                    </div>
                  )
                })}
              </div>
 
              {/* Deck + Discard pile */}
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-14 h-20 rounded-lg border-2 border-purple-500/40 bg-[#1a0a2e] flex items-center justify-center text-purple-400 font-black text-sm cursor-pointer hover:border-purple-400 transition"
                    onClick={!mustDiscard && currentTurn===0 ? humanDraw : undefined}>
                    จั่ว<br/>{deck.length}
                  </div>
                  <span className="text-[10px] text-gray-600 font-bold">กองไพ่</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <DiscardTop card={discardPile[discardPile.length - 1]} />
                  <span className="text-[10px] text-gray-600 font-bold">กองทิ้ง</span>
                </div>
              </div>
 
              {/* Human hand */}
              <div className={`bg-black/60 rounded-2xl border p-4 transition-all ${currentTurn===0 ? 'border-yellow-500/30' : 'border-white/8'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">ไพ่ของคุณ — {humanP?.score} แต้ม</span>
                  {currentTurn === 0 && !mustDiscard && (
                    <span className="text-[10px] text-yellow-400 animate-pulse font-black">ตาของคุณ!</span>
                  )}
                  {mustDiscard && (
                    <span className="text-[10px] text-red-400 font-black">เลือกไพ่ที่จะทิ้ง</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {humanP?.hand.map((c, i) => (
                    <CardUI key={i} card={c}
                      highlight={mustDiscard && selectedCard === i}
                      onClick={mustDiscard ? () => humanSelectCard(i) : undefined}
                    />
                  ))}
                </div>
              </div>
 
              {/* Action buttons */}
              <div className="bg-black/80 rounded-2xl border border-white/8 p-4 flex flex-col gap-3">
                {currentTurn !== 0 ? (
                  <p className="text-center text-gray-600 font-black animate-pulse text-sm py-1">
                    รอ {players[currentTurn]?.name}...
                  </p>
                ) : mustDiscard ? (
                  <button onClick={humanDiscard} disabled={selectedCard===null}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                    🗑️ ทิ้งไพ่ที่เลือก
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <button onClick={humanDraw} disabled={isAnimating}
                      className="py-4 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl text-base transition active:scale-95 disabled:opacity-30">
                      จั่วไพ่
                    </button>
                    <button onClick={humanFlow} disabled={!canFlow || isAnimating}
                      className={`py-4 font-black rounded-xl text-base transition active:scale-95 ${canFlow ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}>
                      {canFlow && canSlap(players[0]?.hand??[], discardPile[discardPile.length-1]) ? 'ตบ! 🎉' : `ไหล ${canFlow ? '✓' : ''}`}
                    </button>
                    <button onClick={humanDeclareKaeng} disabled={!canDeclare || isAnimating}
                      className="py-4 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-base transition active:scale-95 disabled:opacity-30">
                      แคง!
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
 
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
 
          {/* Score board */}
          {phase === 'PLAYING' && (
            <div className="bg-black/70 rounded-2xl border border-white/8 p-4">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">แต้มในมือ</p>
              {players.map((p, i) => (
                <div key={i} className={`flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 ${currentTurn===i?'text-white':'text-gray-600'}`}>
                  <span className="text-xs font-black">{p.name} {currentTurn===i && '◀'}</span>
                  <span className={`text-sm font-black ${i===0?'text-yellow-400':'text-gray-500'}`}>
                    {i===0 ? `${p.score} แต้ม` : `${p.hand.length} ใบ`}
                  </span>
                </div>
              ))}
            </div>
          )}
 
          {/* Log */}
          <div className="bg-black/70 rounded-2xl border border-white/8 p-4 flex flex-col gap-2 h-48 lg:flex-1">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest">📋 บันทึกการเล่น</p>
            <div className="flex-1 overflow-y-auto scr flex flex-col gap-1 min-h-0">
              {log.length === 0
                ? <p className="text-gray-800 text-xs text-center mt-4">ยังไม่มีการกระทำ</p>
                : log.map((l, i) => <p key={i} className="text-xs text-gray-400 font-bold">{l}</p>)
              }
            </div>
          </div>
 
          {/* Rules */}
          <div className="bg-black/70 rounded-2xl border border-white/8 p-4">
            <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-3">กติกา</p>
            <div className="space-y-1.5 text-[11px] text-gray-600 font-bold">
              <p><span className="text-yellow-600">เป้าหมาย</span> — แต้มรวมน้อยที่สุด</p>
              <p><span className="text-yellow-600">A</span>=1 · <span className="text-yellow-600">2–10</span>=ตามหน้า · <span className="text-yellow-600">J/Q/K</span>=10</p>
              <p><span className="text-yellow-600">จั่ว</span> — รับไพ่จากกองกลาง แล้วทิ้ง 1 ใบ</p>
              <p><span className="text-yellow-600">ไหล</span> — ทิ้งตามคนก่อน (ค่าเดียวกัน)</p>
              <p><span className="text-yellow-600">แคง</span> — ประกาศเมื่อแต้มน้อยสุด</p>
              <p><span className="text-yellow-600">น็อค</span> — ไพ่หมดมือ ชนะทันที</p>
            </div>
          </div>
 
          <Link href="/games/kaeng/multiplayer"
            className="block text-center py-3 rounded-2xl border border-purple-500/30 bg-purple-900/15 hover:bg-purple-900/25 text-purple-300 font-black text-sm transition">
            👥 เล่น Multiplayer →
          </Link>
        </div>
 
      </div>
    </div>
  )
}
 
