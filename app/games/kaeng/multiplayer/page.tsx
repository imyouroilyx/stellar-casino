// src/app/games/kaeng/multiplayer/page.tsx
// ไพ่แคง Multiplayer — 2–4 คน Realtime
// กติกา: แต้มน้อยสุดชนะ, จั่ว-ทิ้ง, ไหล, แคง, น็อค
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import type { RealtimeChannel } from '@supabase/supabase-js'
 
// ─── Game Logic ───────────────────────────────────────────────────────────────
const SUITS  = ['♠','♥','♦','♣'] as const
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const
type Card = { suit:string; value:string; score:number }
 
function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const value of VALUES) {
    const score = value==='A' ? 1 : ['J','Q','K'].includes(value) ? 10 : parseInt(value)
    deck.push({ suit, value, score })
  }
  for (let i=deck.length-1; i>0; i--) {
    const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]
  }
  return deck
}
const handScore = (cards: Card[]) => cards.reduce((s,c)=>s+c.score, 0)
const isRed = (suit:string) => suit==='♥'||suit==='♦'
 
// ─── Types ────────────────────────────────────────────────────────────────────
const MAX_PLAYERS = 4
const MIN_BET     = 10
 
type PlayerAction = 'IDLE' | 'WAITING' | 'MY_TURN' | 'DONE'
type RoomPhase    = 'LOBBY' | 'PLAYING' | 'RESULT'
type EndReason    = 'KAENG' | 'KNOCK' | null
 
interface Player {
  id:         string
  username:   string
  avatar_url: string|null
  balance:    number
  hand:       Card[]
  bet:        number
  score:      number
  action:     PlayerAction
  netChange:  number
  isOnline:   boolean
}
 
interface Room {
  id:          string
  code:        string
  hostId:      string
  phase:       RoomPhase
  players:     Player[]
  deck:        Card[]
  discardPile: Card[]
  currentTurn: number   // index ใน players
  roundNumber: number
  endReason:   EndReason
  winnerIdx:   number
  gameLog:     string[]
}
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase()
const isRed2  = isRed
 
// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ url, name, size=32, online }:{ url:string|null; name:string; size?:number; online?:boolean }) {
  return (
    <div className="relative shrink-0" style={{ width:size, height:size }}>
      {url
        ? <Image src={url} alt={name} fill className="rounded-full object-cover border-2 border-white/10" unoptimized />
        : <div className="rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center font-black text-white border-2 border-white/10"
            style={{ width:size, height:size, fontSize:size*0.4 }}>
            {name.charAt(0).toUpperCase()}
          </div>
      }
      {online!==undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#080b12] ${online?'bg-green-400':'bg-gray-600'}`}/>
      )}
    </div>
  )
}
 
function CardSm({ card, hidden, highlight, onClick }:{
  card?:Card; hidden?:boolean; highlight?:boolean; onClick?:()=>void
}) {
  const base = 'w-10 h-14 rounded-lg border-2 flex items-center justify-center font-black text-sm card-deal shrink-0'
  if (!card||hidden) return <div className={`${base} border-purple-500/40 bg-[#1a0a2e] text-purple-400`}>★</div>
  return (
    <div onClick={onClick}
      className={`${base} bg-white transition-all
        ${highlight ? 'border-yellow-400 -translate-y-2 shadow-yellow-400/40 shadow-lg cursor-pointer' : 'border-gray-200'}
        ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}
      `}>
      <span className={isRed2(card.suit)?'text-red-500':'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}
 
function PhaseBadge({ phase }:{ phase:RoomPhase }) {
  const cfg:Record<RoomPhase,{label:string;cls:string}> = {
    LOBBY:   {label:'● รอผู้เล่น',  cls:'bg-green-500/15  text-green-400  border-green-500/20'},
    PLAYING: {label:'🃏 กำลังเล่น', cls:'bg-purple-500/15 text-purple-400 border-purple-500/20'},
    RESULT:  {label:'🏆 ผลการแข่ง', cls:'bg-blue-500/15   text-blue-400   border-blue-500/20'},
  }
  const {label,cls}=cfg[phase]
  return <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${cls}`}>{label}</span>
}
 
// ══════════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════════
export default function KaengMultiplayer() {
  const router = useRouter()
  const { profile, syncUser } = useUser()
 
  const [screen,       setScreen]       = useState<'LIST'|'ROOM'>('LIST')
  const [lobbyList,    setLobbyList]    = useState<{id:string;code:string;count:number;hostName:string}[]>([])
  const [joinCode,     setJoinCode]     = useState('')
  const [room,         setRoom]         = useState<Room|null>(null)
  const roomRef                         = useRef<Room|null>(null)
  const channelRef                      = useRef<RealtimeChannel|null>(null)
 
  const [betInput,      setBetInput]      = useState(MIN_BET)
  const [selectedCard,  setSelectedCard]  = useState<number|null>(null)
  const [toast,         setToast]         = useState('')
  const [chatInput,     setChatInput]     = useState('')
  const [chatLog,       setChatLog]       = useState<{uid:string;name:string;msg:string}[]>([])
  const [kickTarget,    setKickTarget]    = useState<string|null>(null)
  const [resultVisible, setResultVisible] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
 
  const sfx = useRef<Record<string,HTMLAudioElement>>({})
  useEffect(() => {
    sfx.current.flip    = new Audio('/sounds/Card-flip.wav')
    sfx.current.win     = new Audio('/sounds/Win.wav')
    sfx.current.lose    = new Audio('/sounds/Lose.wav')
    sfx.current.shuffle = new Audio('/sounds/Card-shuffle.wav')
    fetchLobby()
  }, [])
  const play   = (k:string) => { const a=sfx.current[k]; if(a){a.currentTime=0;a.play().catch(()=>{})} }
  const toast_ = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),3000) }
 
  useEffect(()=>{ roomRef.current=room },[room])
  useEffect(()=>{ chatBottomRef.current?.scrollIntoView({behavior:'smooth'}) },[chatLog])
 
  useEffect(()=>{
    if (room?.phase==='RESULT') {
      setResultVisible(false)
      const t=setTimeout(()=>setResultVisible(true), 1800)
      return ()=>clearTimeout(t)
    } else { setResultVisible(false) }
  },[room?.phase])
 
  // ── Fetch lobby ─────────────────────────────────────────────────────────
  const fetchLobby = async () => {
    const { data } = await supabase
      .from('kaeng_rooms').select('id, code, players, profiles!host_id(username)')
      .eq('phase','LOBBY').order('created_at',{ascending:false}).limit(20)
    if (data) setLobbyList(data.map((r:any)=>({
      id:r.id, code:r.code, count:r.players?.length??0, hostName:r.profiles?.username??'—',
    })))
  }
 
  // ── Parse DB row → Room ─────────────────────────────────────────────────
  const parseRoom = (d:any): Room => ({
    id:d.id, code:d.code, hostId:d.host_id, phase:d.phase,
    players:d.players??[], deck:d.deck??[], discardPile:d.discard_pile??[],
    currentTurn:d.current_turn??0, roundNumber:d.round_number??1,
    endReason:d.end_reason??null, winnerIdx:d.winner_idx??-1,
    gameLog:d.game_log??[],
  })
 
  // ── Subscribe ────────────────────────────────────────────────────────────
  const subscribe = useCallback((roomId:string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`kaeng:${roomId}`,{config:{presence:{key:profile?.id??''}}})
      .on('postgres_changes',{event:'*',schema:'public',table:'kaeng_rooms',filter:`id=eq.${roomId}`},
        ({new:raw})=>{
          const r=raw as any; if(!r?.id) return
          const parsed=parseRoom(r)
          setRoom(parsed)
          if (profile&&!parsed.players.find(p=>p.id===profile.id)) {
            toast_('คุณถูกเตะออกจากห้อง')
            channelRef.current&&supabase.removeChannel(channelRef.current)
            setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby(); return
          }
          if (r.phase==='RESULT'&&profile) {
            const me=parsed.players.find(p=>p.id===profile.id)
            setTimeout(()=>{ if(me&&me.netChange>0) play('win'); else if(me&&me.netChange<0) play('lose') },1800)
          }
        })
      .on('broadcast',{event:'chat'},({payload})=>{
        setChatLog(prev=>[...prev.slice(-99),payload])
      })
      .on('presence',{event:'sync'},()=>{
        const ids=new Set(Object.keys(ch.presenceState()))
        setRoom(prev=>prev?{...prev,players:prev.players.map(p=>({...p,isOnline:ids.has(p.id)}))}:prev)
      })
      .subscribe(async s=>{ if(s==='SUBSCRIBED') await ch.track({userId:profile?.id}) })
    channelRef.current=ch
  },[profile])
 
  const dbUpdate = async (patch:Record<string,unknown>) => {
    if (!roomRef.current) return
    await supabase.from('kaeng_rooms').update(patch).eq('id',roomRef.current.id)
  }
 
  const addLog = async (msg:string, currentLog:string[]) => {
    return [...currentLog.slice(-29), msg]
  }
 
  // ── Create ───────────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const me:Player = {
      id:profile.id, username:profile.username??'ผู้เล่น', avatar_url:profile.avatar_url??null,
      balance:profile.balance, hand:[], bet:0, score:0, action:'IDLE', netChange:0, isOnline:true,
    }
    const {data,error}=await supabase.from('kaeng_rooms').insert([{
      code:genCode(), host_id:profile.id, phase:'LOBBY',
      players:[me], deck:[], discard_pile:[], current_turn:0,
      round_number:1, end_reason:null, winner_idx:-1, game_log:[],
    }]).select().single()
    if(error||!data) return toast_('สร้างห้องไม่สำเร็จ')
    setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM')
  }
 
  // ── Join ─────────────────────────────────────────────────────────────────
  const joinRoom = async (id?:string, code?:string) => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const q=supabase.from('kaeng_rooms').select('*')
    const {data,error}=id?await q.eq('id',id).single():await q.eq('code',(code||joinCode).toUpperCase()).single()
    if(error||!data) return toast_('ไม่พบห้อง')
    if((data.players as Player[]).find(p=>p.id===profile.id)){
      setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM'); return
    }
    if(data.phase!=='LOBBY') return toast_('เกมเริ่มไปแล้ว')
    if((data.players as Player[]).length>=MAX_PLAYERS) return toast_('ห้องเต็มแล้ว')
    const me:Player={
      id:profile.id, username:profile.username??'ผู้เล่น', avatar_url:profile.avatar_url??null,
      balance:profile.balance, hand:[], bet:0, score:0, action:'IDLE', netChange:0, isOnline:true,
    }
    const updated=[...data.players,me]
    await supabase.from('kaeng_rooms').update({players:updated}).eq('id',data.id)
    setRoom(parseRoom({...data,players:updated})); subscribe(data.id); setScreen('ROOM')
  }
 
  // ── Leave ────────────────────────────────────────────────────────────────
  const leaveRoom = async () => {
    if (!room||!profile) return
    const remaining=room.players.filter(p=>p.id!==profile.id)
    if(remaining.length===0){
      await supabase.from('kaeng_rooms').delete().eq('id',room.id)
    } else {
      await dbUpdate({players:remaining,host_id:room.hostId===profile.id?remaining[0].id:room.hostId})
    }
    channelRef.current&&supabase.removeChannel(channelRef.current)
    setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby()
  }
 
  // ── Kick ─────────────────────────────────────────────────────────────────
  const kickPlayer = async (targetId:string) => {
    if (!room||room.hostId!==profile?.id) return
    setKickTarget(null)
    await dbUpdate({players:room.players.filter(p=>p.id!==targetId)})
  }
 
  // ── Start game (Host) ────────────────────────────────────────────────────
  const startGame = async () => {
    if (!room||room.hostId!==profile?.id) return
    if (room.players.length<2) return toast_('ต้องการผู้เล่นอย่างน้อย 2 คน')
    const totalBet = betInput * room.players.length
    for (const p of room.players) {
      if (p.balance < betInput) return toast_(`${p.username} ยอดเงินไม่พอ`)
    }
    play('shuffle')
    const newDeck = makeDeck()
    // แจก 5 ใบต่อคน
    const dealt = room.players.map(p => {
      const hand = newDeck.splice(0, 5)
      return { ...p, hand, bet:betInput, score:handScore(hand), action:'WAITING' as PlayerAction, netChange:0 }
    })
    // หักเงิน
    for (const p of dealt) {
      const {data:curr}=await supabase.from('profiles').select('balance').eq('id',p.id).single()
      if(curr) await supabase.from('profiles').update({balance:curr.balance-betInput}).eq('id',p.id)
    }
    dealt[0].action = 'MY_TURN'
    await dbUpdate({
      phase:'PLAYING', players:dealt, deck:newDeck, discard_pile:[],
      current_turn:0, end_reason:null, winner_idx:-1, game_log:['แจกไพ่แล้ว — ตาของ '+dealt[0].username],
    })
    syncUser()
  }
 
  // ── Action helpers ────────────────────────────────────────────────────────
  const myIdx = room?.players.findIndex(p=>p.id===profile?.id) ?? -1
  const isMyTurn = room?.phase==='PLAYING' && room?.currentTurn === myIdx
  const me = myIdx >= 0 ? room?.players[myIdx] : undefined
  const topDiscard = room?.discardPile[room.discardPile.length-1]
  const canFlow = isMyTurn && !!topDiscard && (me?.hand??[]).some(c=>c.value===topDiscard.value)
  const mustDiscard = isMyTurn && (me?.hand?.length??0) === 6  // จั่วแล้วต้องทิ้ง
 
  // ── Draw card ────────────────────────────────────────────────────────────
  const actionDraw = async () => {
    if (!room||!profile||!isMyTurn||mustDiscard) return
    if (room.deck.length===0) return await endGame('KAENG')
    play('flip')
    const drawn = room.deck[0]
    const newDeck = room.deck.slice(1)
    const newHand = [...(me?.hand??[]), drawn]
    const newLog = await addLog(`${me?.username} จั่ว ${drawn.value}${drawn.suit}`, room.gameLog)
    const newPlayers = room.players.map((p,i)=>i===myIdx?{...p,hand:newHand,score:handScore(newHand)}:p)
    await dbUpdate({players:newPlayers, deck:newDeck, game_log:newLog})
    setSelectedCard(null)
  }
 
  // ── Flow ─────────────────────────────────────────────────────────────────
  const actionFlow = async () => {
    if (!room||!profile||!isMyTurn||!canFlow||mustDiscard) return
    const top = topDiscard!
    const flowIdx = (me?.hand??[]).findIndex(c=>c.value===top.value)
    if (flowIdx===-1) return
    play('flip')
    const newHand = (me?.hand??[]).filter((_,i)=>i!==flowIdx)
    const newDp   = [...room.discardPile, (me?.hand??[])[flowIdx]]
    const newLog  = await addLog(`${me?.username} ไหล ${top.value}${top.suit}`, room.gameLog)
 
    if (newHand.length===0) {
      // น็อค!
      const newPlayers = room.players.map((p,i)=>i===myIdx?{...p,hand:newHand,score:0}:p)
      await dbUpdate({players:newPlayers, discard_pile:newDp, game_log:[...newLog,'🎉 น็อค! '+me?.username+' ไพ่หมดมือ!']})
      return await endGame('KNOCK', myIdx, newPlayers)
    }
 
    const newPlayers = room.players.map((p,i)=>i===myIdx?{...p,hand:newHand,score:handScore(newHand)}:p)
    const next = (myIdx+1)%room.players.length
    const nextPlayers = newPlayers.map((p,i)=>({...p, action:(i===next?'MY_TURN':'WAITING') as PlayerAction}))
    await dbUpdate({players:nextPlayers, discard_pile:newDp, current_turn:next, game_log:newLog})
    setSelectedCard(null)
  }
 
  // ── Discard selected card ─────────────────────────────────────────────────
  const actionDiscard = async () => {
    if (!room||!profile||!isMyTurn||!mustDiscard||selectedCard===null) return
    play('flip')
    const hand = me?.hand??[]
    const discarded = hand[selectedCard]
    const newHand   = hand.filter((_,i)=>i!==selectedCard)
    const newDp     = [...room.discardPile, discarded]
    const newLog    = await addLog(`${me?.username} ทิ้ง ${discarded.value}${discarded.suit}`, room.gameLog)
    const next = (myIdx+1)%room.players.length
    const newPlayers = room.players.map((p,i)=>{
      if (i===myIdx) return {...p, hand:newHand, score:handScore(newHand), action:'WAITING' as PlayerAction}
      if (i===next)  return {...p, action:'MY_TURN' as PlayerAction}
      return p
    })
    await dbUpdate({players:newPlayers, discard_pile:newDp, current_turn:next, game_log:newLog})
    setSelectedCard(null)
  }
 
  // ── Declare Kaeng ─────────────────────────────────────────────────────────
  const actionDeclareKaeng = async () => {
    if (!room||!profile||!isMyTurn||mustDiscard) return
    const newLog = await addLog(`${me?.username} ประกาศ แคง! (${me?.score} แต้ม)`, room.gameLog)
    await dbUpdate({game_log:newLog})
    await endGame('KAENG', myIdx)
  }
 
  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = async (reason:EndReason, forcedWinner?:number, overridePlayers?:Player[]) => {
    if (!room) return
    const ps = overridePlayers ?? room.players
 
    let winIdx = forcedWinner ?? -1
    if (reason==='KAENG' && winIdx===-1) {
      // หาคนแต้มน้อยสุด
      let minScore=Infinity
      ps.forEach((p,i)=>{ if(p.score<minScore){minScore=p.score;winIdx=i} })
    }
    if (reason==='KNOCK' && winIdx===-1 && forcedWinner!==undefined) winIdx=forcedWinner
 
    // ── คำนวณเงิน ─────────────────────────────────────────────────────────────
    // แคง:  ผู้ชนะได้ bet จากทุกคนในวง (× จำนวนคนแพ้)
    // น็อค: ผู้ชนะได้ bet×2 จากทุกคน, คนแพ้เสีย bet×2
    const winner = ps[winIdx]
    const losers = ps.filter((_,i) => i !== winIdx)
    const payPerLoser = reason === 'KNOCK' ? winner.bet * 2 : winner.bet
    const winnerNet   = payPerLoser * losers.length
 
    const settled = ps.map((p, i) => {
      if (i === winIdx) return { ...p, action: 'DONE' as PlayerAction, netChange: winnerNet }
      return { ...p, action: 'DONE' as PlayerAction, netChange: -payPerLoser }
    })
 
    await dbUpdate({
      phase: 'RESULT', players: settled, winner_idx: winIdx, end_reason: reason,
      game_log: [...(room.gameLog), `🏆 ${winner.username} ชนะ! (${reason==='KNOCK'?'น็อค':'แคง'}) · ${winner.score} แต้ม`],
    })
 
    // อัปเดต balance
    // bet ถูกหักไปแล้วตอน startGame ดังนั้น:
    //   ผู้ชนะ: คืน bet + รับเงิน winnerNet → +bet +winnerNet
    //   ผู้แพ้:  คืน bet - เสีย payPerLoser  → +bet -payPerLoser
    for (const p of settled) {
      const {data:curr} = await supabase.from('profiles').select('balance').eq('id', p.id).single()
      if (!curr) continue
      const newBalance = curr.balance + p.bet + p.netChange
      await supabase.from('profiles').update({ balance: newBalance }).eq('id', p.id)
      await supabase.from('game_logs').insert([{
        user_id: p.id, game_name: 'Kaeng-Multi',
        change_amount: p.netChange,
        result: `${p.netChange >= 0 ? `ชนะ +$${p.netChange}` : `แพ้ -$${Math.abs(p.netChange)}`} · ${reason==='KNOCK'?'น็อค':'แคง'} · ${p.score} แต้ม`,
      }])
    }
    syncUser()
  }
 
  // ── Next round ────────────────────────────────────────────────────────────
  const nextRound = async () => {
    if (!room||room.hostId!==profile?.id) return
    await dbUpdate({
      phase:'LOBBY', players:room.players.map(p=>({...p,hand:[],bet:0,score:0,action:'IDLE',netChange:0})),
      deck:[], discard_pile:[], current_turn:0, round_number:room.roundNumber+1,
      end_reason:null, winner_idx:-1, game_log:[],
    })
  }
 
  // ── Chat ─────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()||!room||!profile) return
    const payload={uid:profile.id,name:profile.username??'ผู้เล่น',msg:chatInput.trim()}
    setChatLog(prev=>[...prev.slice(-99),payload]); setChatInput('')
    await channelRef.current?.send({type:'broadcast',event:'chat',payload})
  }
 
  // ─── Derived ──────────────────────────────────────────────────────────────
  const isHost = room?.hostId===profile?.id
 
  // ══════════════════════════════════════════════════════════════════════════
  // LIST SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (screen==='LIST') return (
    <div className="min-h-screen bg-[#080b12] text-white"
      style={{backgroundImage:"url('https://iili.io/qZ3dyUg.png')",backgroundSize:'cover',backgroundAttachment:'fixed'}}>
      {toast&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">{toast}</div>}
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push('/games/kaeng/select')}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition text-lg">←</button>
          <div>
            <h1 className="text-2xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 tracking-tight">ไพ่แคง</h1>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Multiplayer · 2–4 คน · จั่ว ไหล แคง น็อค</p>
          </div>
        </div>
 
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">สร้างห้องใหม่</h2>
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 rounded-xl border border-white/8">
            <span className="text-gray-500 text-sm font-bold">เดิมพันต่อรอบ</span>
            <span className="text-yellow-400 font-black text-xl">${betInput}</span>
          </div>
          <div className="flex gap-2">
            {[10,50,100,500].map(v=>(
              <button key={v} onClick={()=>setBetInput(b=>b+v)}
                className="flex-1 py-2 bg-white/5 rounded-lg font-black text-sm hover:bg-yellow-500 hover:text-black transition">+{v}</button>
            ))}
            <button onClick={()=>setBetInput(MIN_BET)} className="px-3 py-2 bg-red-900/30 text-red-400 rounded-lg font-black text-sm">↺</button>
          </div>
          <button onClick={createRoom}
            className="py-3 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 rounded-xl font-black text-base transition active:scale-95">
            🏠 สร้างห้อง
          </button>
        </div>
 
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">เข้าด้วยรหัส</h2>
          <div className="flex gap-2">
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e=>e.key==='Enter'&&joinRoom(undefined,joinCode)}
              placeholder="A1B2C3" maxLength={6}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-black text-center tracking-[.3em] text-lg focus:outline-none focus:border-purple-500 uppercase"/>
            <button onClick={()=>joinRoom(undefined,joinCode)}
              className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition text-sm">เข้าร่วม</button>
          </div>
        </div>
 
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">ห้องที่เปิดอยู่</h2>
            <button onClick={fetchLobby} className="text-xs text-gray-600 hover:text-white font-bold transition">🔄 รีเฟรช</button>
          </div>
          {lobbyList.length===0
            ? <p className="text-center text-gray-700 font-bold py-10 text-sm">ยังไม่มีห้อง</p>
            : lobbyList.map(r=>(
              <button key={r.id} onClick={()=>joinRoom(r.id)}
                className="flex items-center gap-4 p-4 bg-black/50 border border-white/6 rounded-xl hover:border-purple-500/30 hover:bg-purple-900/10 transition text-left w-full">
                <span className="text-2xl">🃏</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm">ห้อง #{r.code}</p>
                  <p className="text-gray-600 text-xs">โดย {r.hostName}</p>
                </div>
                <div className="flex gap-1">
                  {Array(r.count).fill(0).map((_,i)=><div key={i} className="w-2 h-2 rounded-full bg-purple-400"/>)}
                  {Array(MAX_PLAYERS-r.count).fill(0).map((_,i)=><div key={i} className="w-2 h-2 rounded-full bg-white/10"/>)}
                </div>
                <span className="text-xs text-purple-400 font-black shrink-0">{r.count}/{MAX_PLAYERS}</span>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )
 
  // ══════════════════════════════════════════════════════════════════════════
  // ROOM SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!room) return null
 
  return (
    <div className="min-h-screen bg-[#080b12] text-white flex flex-col"
      style={{backgroundImage:"url('https://iili.io/qZ3dyUg.png')",backgroundSize:'cover',backgroundAttachment:'fixed'}}>
      <style>{`
        @keyframes cardDeal{from{opacity:0;transform:translateY(-40px) rotate(-10deg) scale(.85)}to{opacity:1;transform:none}}
        .card-deal{animation:cardDeal .3s cubic-bezier(.22,1,.36,1) both}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,.4)}50%{box-shadow:0 0 0 8px rgba(168,85,247,0)}}
        .glow-me{animation:glowPulse 1.6s ease infinite}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .slide-up{animation:slideUp .4s ease forwards}
        .scr::-webkit-scrollbar{width:3px}.scr::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:9px}
      `}</style>
 
      {toast&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">{toast}</div>}
 
      {kickTarget&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 w-72 shadow-2xl">
            <span className="text-3xl">🚫</span>
            <p className="font-black text-white text-center">เตะ <span className="text-red-400">{room.players.find(p=>p.id===kickTarget)?.username}</span> ออก?</p>
            <div className="flex gap-3 w-full">
              <button onClick={()=>setKickTarget(null)} className="flex-1 py-2.5 bg-white/5 rounded-xl font-black text-sm hover:bg-white/10 transition">ยกเลิก</button>
              <button onClick={()=>kickPlayer(kickTarget)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-black text-sm transition text-white">เตะออก</button>
            </div>
          </div>
        </div>
      )}
 
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/50 backdrop-blur-sm shrink-0">
        <button onClick={leaveRoom} className="text-xs font-bold text-gray-500 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg transition">← ออก</button>
        <div className="flex-1 flex items-center gap-2 justify-center flex-wrap">
          <span className="font-black text-base italic text-white">ไพ่แคง</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500 font-bold tracking-widest">#{room.code}</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500 font-bold">รอบ {room.roundNumber}</span>
          <PhaseBadge phase={room.phase}/>
        </div>
        <div className="text-xs text-gray-600 font-bold">{room.players.length}/{MAX_PLAYERS}</div>
      </div>
 
      <div className="flex flex-1 overflow-hidden">
 
        {/* ═══ BOARD ══════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-y-auto scr p-4 gap-4">
 
          {/* Opponents */}
          {room.phase==='PLAYING' && (
            <div className="grid grid-cols-3 gap-3">
              {room.players.filter((_,i)=>i!==myIdx).map((p,_i)=>{
                const realIdx = room.players.indexOf(p)
                const isActive = room.currentTurn===realIdx
                return (
                  <div key={p.id} className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all ${isActive?'border-purple-500/40 bg-purple-900/10':'border-white/8 bg-black/40'}`}>
                    <div className="flex items-center gap-2">
                      <Avatar url={p.avatar_url} name={p.username} size={24} online={p.isOnline}/>
                      <span className={`text-xs font-black truncate ${isActive?'text-purple-300':'text-gray-500'}`}>{p.username}</span>
                      {isActive&&<span className="ml-auto text-[10px] text-purple-400 animate-pulse">ตา</span>}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {p.hand.map((_c,j)=><CardSm key={j} hidden/>)}
                      {p.hand.length===0&&<span className="text-[10px] text-gray-700">ยังไม่มีไพ่</span>}
                    </div>
                    <span className="text-[10px] text-gray-700 font-bold">{p.hand.length} ใบ</span>
                  </div>
                )
              })}
            </div>
          )}
 
          {/* Deck + Discard */}
          {room.phase==='PLAYING' && (
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-14 h-20 rounded-lg border-2 flex items-center justify-center font-black text-sm
                  ${isMyTurn&&!mustDiscard?'border-purple-400 bg-purple-900/30 cursor-pointer hover:bg-purple-900/50':'border-purple-500/20 bg-[#1a0a2e]'} text-purple-400`}
                  onClick={isMyTurn&&!mustDiscard?actionDraw:undefined}>
                  จั่ว<br/>{room.deck.length}
                </div>
                <span className="text-[10px] text-gray-600 font-bold">กองไพ่</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-20 rounded-lg border-2 border-white/20 bg-white flex items-center justify-center font-black text-xl shadow-md">
                  {topDiscard
                    ? <span className={isRed(topDiscard.suit)?'text-red-500':'text-gray-900'}>{topDiscard.value}{topDiscard.suit}</span>
                    : <span className="text-gray-400 text-xs">กอง<br/>ทิ้ง</span>
                  }
                </div>
                <span className="text-[10px] text-gray-600 font-bold">กองทิ้ง</span>
              </div>
            </div>
          )}
 
          {/* My hand */}
          {room.phase==='PLAYING' && me && (
            <div className={`rounded-2xl border p-4 transition-all ${isMyTurn?'border-yellow-500/40 bg-yellow-900/10 glow-me':'border-white/8 bg-black/40'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-yellow-400">ไพ่ของคุณ — {me.score} แต้ม</span>
                {isMyTurn&&!mustDiscard&&<span className="text-[10px] text-yellow-400 animate-pulse font-black">⭐ ตาของคุณ</span>}
                {mustDiscard&&<span className="text-[10px] text-red-400 font-black">เลือกไพ่ที่จะทิ้ง</span>}
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {me.hand.map((c,i)=>(
                  <CardSm key={i} card={c}
                    highlight={mustDiscard&&selectedCard===i}
                    onClick={mustDiscard?()=>setSelectedCard(i===selectedCard?null:i):undefined}
                  />
                ))}
              </div>
            </div>
          )}
 
          {/* RESULT */}
          {room.phase==='RESULT' && resultVisible && (
            <div className="bg-black/70 border border-white/8 rounded-2xl p-5 flex flex-col gap-4 slide-up">
              <div className="text-center">
                <p className={`text-2xl font-black ${me&&me.netChange>0?'text-green-400':'text-red-400'}`}>
                  {me&&me.netChange>0
                    ? `🏆 ชนะ! +$${me.netChange} ${room.endReason==='KNOCK'?'(น็อค!)':''}`
                    : `💀 แพ้ -$${me?Math.abs(me.netChange):0}`
                  }
                </p>
                <p className="text-gray-500 text-xs font-bold mt-1">
                  {room.endReason==='KNOCK'?'น็อค':'แคง'} · ผู้ชนะ: {room.players[room.winnerIdx]?.username}
                </p>
              </div>
              {/* All hands */}
              <div className="grid grid-cols-2 gap-2">
                {room.players.map((p,i)=>(
                  <div key={i} className={`p-3 rounded-xl border ${room.winnerIdx===i?'border-yellow-500/40 bg-yellow-900/10':'border-white/8 bg-black/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar url={p.avatar_url} name={p.username} size={20}/>
                      <span className="text-xs font-black truncate">{p.username} {room.winnerIdx===i&&'🏆'}</span>
                      <span className={`ml-auto text-xs font-black ${p.netChange>0?'text-green-400':p.netChange<0?'text-red-400':'text-gray-500'}`}>
                        {p.netChange>0?`+$${p.netChange}`:p.netChange<0?`-$${Math.abs(p.netChange)}`:'±0'}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {p.hand.map((c,j)=><CardSm key={j} card={c}/>)}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">{p.score} แต้ม</p>
                  </div>
                ))}
              </div>
              {isHost
                ? <button onClick={nextRound} className="w-full py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl transition active:scale-95">🔄 รอบถัดไป</button>
                : <p className="text-center text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้อง...</p>
              }
            </div>
          )}
          {room.phase==='RESULT'&&!resultVisible&&(
            <div className="bg-black/60 rounded-2xl border border-white/8 p-6 text-center">
              <p className="text-gray-500 font-bold animate-pulse">นับแต้ม...</p>
            </div>
          )}
 
          {/* ── Control panel ── */}
          <div className="bg-black/70 border border-white/8 rounded-2xl p-4">
 
            {/* LOBBY */}
            {room.phase==='LOBBY' && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-bold mb-1">รหัสห้อง</p>
                  <p className="text-yellow-400 font-black text-3xl tracking-[.3em]">{room.code}</p>
                </div>
                {isHost
                  ? (
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/8">
                        <span className="text-gray-500 text-xs font-bold">เดิมพัน/คน</span>
                        <span className="text-yellow-400 font-black">${betInput}</span>
                      </div>
                      <button onClick={startGame} disabled={room.players.length<2}
                        className="w-full py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                        {room.players.length<2?`รอผู้เล่น (${room.players.length}/2)`:'🃏 แจกไพ่!'}
                      </button>
                    </div>
                  )
                  : <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้องเริ่มเกม...</p>
                }
              </div>
            )}
 
            {/* PLAYING */}
            {room.phase==='PLAYING' && !isMyTurn && (
              <p className="text-center text-gray-600 font-black animate-pulse text-sm py-2">
                รอ {room.players[room.currentTurn]?.username}...
              </p>
            )}
 
            {room.phase==='PLAYING' && isMyTurn && mustDiscard && (
              <button onClick={actionDiscard} disabled={selectedCard===null}
                className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                🗑️ ทิ้งไพ่ที่เลือก
              </button>
            )}
 
            {room.phase==='PLAYING' && isMyTurn && !mustDiscard && (
              <div className="grid grid-cols-3 gap-3">
                <button onClick={actionDraw}
                  className="py-4 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl text-base transition active:scale-95">
                  🃏 จั่วไพ่
                </button>
                <button onClick={actionFlow} disabled={!canFlow}
                  className={`py-4 font-black rounded-xl text-base transition active:scale-95 ${canFlow?'bg-yellow-500 hover:bg-yellow-400 text-black':'bg-white/5 text-gray-600 cursor-not-allowed'}`}>
                  ไหล {canFlow&&'✓'}
                </button>
                <button onClick={actionDeclareKaeng}
                  className="py-4 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-base transition active:scale-95">
                  แคง!
                </button>
              </div>
            )}
          </div>
        </div>
 
        {/* ═══ SIDEBAR ════════════════════════════════════════════════════ */}
        <div className="hidden md:flex w-56 border-l border-white/5 flex-col bg-black/30 shrink-0">
 
          {/* Players */}
          <div className="p-4 border-b border-white/5">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">ผู้เล่น</p>
            <div className="flex flex-col gap-2.5">
              {room.players.map((p,i)=>(
                <div key={p.id} className="flex items-center gap-2 group">
                  <Avatar url={p.avatar_url} name={p.username} size={26} online={p.isOnline}/>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${p.id===profile?.id?'text-yellow-400':'text-white'}`}>
                      {p.username}{p.id===room.hostId?' 👑':''}
                      {room.currentTurn===i&&room.phase==='PLAYING'?' ◀':''}
                    </p>
                    <p className="text-[10px] text-gray-700">${p.balance.toLocaleString()}</p>
                  </div>
                  {isHost&&p.id!==profile?.id&&room.phase==='LOBBY'&&(
                    <button onClick={()=>setKickTarget(p.id)}
                      className="text-[10px] text-gray-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
 
          {/* Game log */}
          {room.phase==='PLAYING' && (
            <div className="p-4 border-b border-white/5 flex-1 flex flex-col min-h-0">
              <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2">📋 บันทึก</p>
              <div className="flex-1 overflow-y-auto scr flex flex-col gap-0.5 min-h-0">
                {[...room.gameLog].reverse().map((l,i)=>(
                  <p key={i} className="text-[11px] text-gray-500 font-bold">{l}</p>
                ))}
              </div>
            </div>
          )}
 
          {/* Chat */}
          <div className="flex-1 flex flex-col p-4 min-h-0">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2">💬 แชท</p>
            <div className="flex-1 overflow-y-auto scr flex flex-col gap-1 min-h-0 mb-3">
              {chatLog.length===0
                ? <p className="text-center text-gray-800 text-xs mt-4">ยังไม่มีข้อความ</p>
                : chatLog.map((c,i)=>(
                  <p key={i} className="text-xs leading-snug">
                    <span className={`font-black ${c.uid===profile?.id?'text-yellow-400':'text-purple-400'}`}>{c.name}: </span>
                    <span className="text-gray-400">{c.msg}</span>
                  </p>
                ))
              }
              <div ref={chatBottomRef}/>
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="ข้อความ..." maxLength={80}
                className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-purple-500"/>
              <button onClick={sendChat} className="px-2.5 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-xs font-black transition">↵</button>
            </div>
          </div>
 
          {/* Rules */}
          <div className="p-4 border-t border-white/5">
            <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-2">กติกา</p>
            <div className="space-y-1 text-[11px] text-gray-600 font-bold">
              <p><span className="text-yellow-600">เป้าหมาย</span> แต้มน้อยสุด</p>
              <p><span className="text-yellow-600">J/Q/K</span>=10 · <span className="text-yellow-600">A</span>=1</p>
              <p><span className="text-yellow-600">จั่ว</span> → รับไพ่ → ทิ้ง 1</p>
              <p><span className="text-yellow-600">ไหล</span> → ค่าเดียวกับกองทิ้ง</p>
              <p><span className="text-yellow-600">แคง</span> → ประกาศเมื่อน้อยสุด</p>
              <p><span className="text-yellow-600">น็อค</span> → ไพ่หมดมือ ชนะทันที</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
