// src/app/games/kaeng/multiplayer/page.tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import type { RealtimeChannel } from '@supabase/supabase-js'
// ─── Inline game logic (ไม่ต้องใช้ไฟล์ kaengLib.ts แยก) ──────────────────────
const SUITS  = ['♠','♥','♦','♣'] as const
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const
type Card = { suit: string; value: string; score: number }
const makeCard = (): Card => {
  const suit  = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]
  const score = value === 'A' ? 1 : ['10','J','Q','K'].includes(value) ? 0 : parseInt(value)
  return { suit, value, score }
}
const calcScore = (cards: Card[]) => cards.reduce((s, c) => s + c.score, 0) % 10
const getHandBonus = (cards: Card[]): { mult: number; label: string } => {
  if (cards.length < 2) return { mult: 1, label: '' }
  if (cards[0].value === cards[1].value) return { mult: 2, label: 'แคง' }
  if (cards[0].suit  === cards[1].suit)  return { mult: 2, label: 'ดอกเดียว' }
  return { mult: 1, label: '' }
}
const isKaao = (cards: Card[]) => cards.length === 2 && calcScore(cards) === 9
const isPaet  = (cards: Card[]) => cards.length === 2 && calcScore(cards) === 8
const isRed   = (suit: string) => suit === '♥' || suit === '♦'

// ─── Types ────────────────────────────────────────────────────────────────────
const MAX_PLAYERS  = 6
const MIN_BET      = 10
const RESULT_DELAY = 2200

type PlayerAction = 'IDLE' | 'BET_PLACED' | 'DECIDING' | 'STAND' | 'HIT' | 'DONE'
type RoomPhase    = 'LOBBY' | 'BETTING' | 'PLAYING' | 'RESULT'

interface Player {
  id:           string
  username:     string
  avatar_url:   string | null
  balance:      number
  cards:        Card[]
  bet:          number
  action:       PlayerAction
  // แต้มสุทธิหลังวัดกับทุกคน (จ่าย/รับจากแต่ละคู่)
  netChange:    number
  // ผลกับแต่ละคน { [opponentId]: 'WIN'|'LOSE'|'DRAW' }
  results:      Record<string, 'WIN' | 'LOSE' | 'DRAW'>
  isOnline:     boolean
}

interface Room {
  id:           string
  code:         string
  hostId:       string
  phase:        RoomPhase
  players:      Player[]
  roundNumber:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genCode  = () => Math.random().toString(36).substring(2, 8).toUpperCase()
const sleep    = (ms: number) => new Promise(r => setTimeout(r, ms))

// Tournament settle: ผู้เล่นแต่ละคู่วัดกัน จ่าย/รับตาม bet ของแต่ละคน
function settleTournament(players: Player[]): Player[] {
  // clone
  const out = players.map(p => ({ ...p, netChange: 0, results: {} as Record<string, 'WIN'|'LOSE'|'DRAW'> }))

  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j]
      const sa = calcScore(a.cards), sb = calcScore(b.cards)
      const { mult: ma } = getHandBonus(a.cards)
      const { mult: mb } = getHandBonus(b.cards)

      if (sa > sb) {
        // a ชนะ b
        const pay = Math.min(a.bet * ma, b.bet)   // b จ่ายไม่เกิน bet ของ b
        a.netChange += pay
        b.netChange -= pay
        a.results[b.id] = 'WIN'; b.results[a.id] = 'LOSE'
      } else if (sb > sa) {
        // b ชนะ a
        const pay = Math.min(b.bet * mb, a.bet)
        b.netChange += pay
        a.netChange -= pay
        b.results[a.id] = 'WIN'; a.results[b.id] = 'LOSE'
      } else {
        // เสมอ
        a.results[b.id] = 'DRAW'; b.results[a.id] = 'DRAW'
      }
    }
  }
  return out
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ url, name, size = 32, online }: { url: string|null; name: string; size?: number; online?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url
        ? <Image src={url} alt={name} fill className="rounded-full object-cover border-2 border-white/10" unoptimized />
        : <div className="rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center font-black text-white border-2 border-white/10"
            style={{ width: size, height: size, fontSize: size * 0.4 }}>
            {name.charAt(0).toUpperCase()}
          </div>
      }
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#080b12] ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
      )}
    </div>
  )
}

function CardSm({ card, hidden }: { card?: Card; hidden?: boolean }) {
  const base = 'w-[46px] h-[64px] rounded-lg border-2 flex items-center justify-center font-black text-base card-deal shrink-0'
  if (!card || hidden) return <div className={`${base} border-purple-500/40 bg-[#1a0a2e] text-purple-400`}>★</div>
  return (
    <div className={`${base} bg-white border-yellow-400/50 shadow-md`}>
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: RoomPhase }) {
  const cfg: Record<RoomPhase, { label: string; cls: string }> = {
    LOBBY:   { label: '● รอผู้เล่น',    cls: 'bg-green-500/15  text-green-400  border-green-500/20'  },
    BETTING: { label: '💰 วางเดิมพัน',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
    PLAYING: { label: '🃏 กำลังเล่น',   cls: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
    RESULT:  { label: '🏆 ผลการแข่ง',   cls: 'bg-blue-500/15   text-blue-400   border-blue-500/20'   },
  }
  const { label, cls } = cfg[phase]
  return <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${cls}`}>{label}</span>
}

// แสดงผล Win/Lose ต่อคู่
function VsBadge({ result }: { result: 'WIN'|'LOSE'|'DRAW' }) {
  const cfg = {
    WIN:  { cls: 'bg-green-500/20 text-green-400 border-green-500/30',   label: 'ชนะ' },
    LOSE: { cls: 'bg-red-500/20   text-red-400   border-red-500/30',     label: 'แพ้' },
    DRAW: { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'เสมอ' },
  }
  return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${cfg[result].cls}`}>{cfg[result].label}</span>
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────────────
export default function KaengMultiplayer() {
  const router = useRouter()
  const { profile, syncUser } = useUser()

  const [screen,       setScreen]       = useState<'LIST'|'ROOM'>('LIST')
  const [lobbyList,    setLobbyList]    = useState<{ id:string; code:string; count:number; hostName:string }[]>([])
  const [joinCode,     setJoinCode]     = useState('')
  const [room,         setRoom]         = useState<Room|null>(null)
  const roomRef                         = useRef<Room|null>(null)
  const channelRef                      = useRef<RealtimeChannel|null>(null)

  const [betInput,      setBetInput]      = useState(MIN_BET)
  const [toast,         setToast]         = useState('')
  const [chatInput,     setChatInput]     = useState('')
  const [chatLog,       setChatLog]       = useState<{ uid:string; name:string; msg:string }[]>([])
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

  useEffect(() => { roomRef.current = room }, [room])
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chatLog])

  // Result delay
  useEffect(() => {
    if (room?.phase === 'RESULT') {
      setResultVisible(false)
      const t = setTimeout(() => setResultVisible(true), RESULT_DELAY)
      return () => clearTimeout(t)
    } else {
      setResultVisible(false)
    }
  }, [room?.phase])

  // ── Fetch lobby ─────────────────────────────────────────────────────────
  const fetchLobby = async () => {
    const { data } = await supabase
      .from('kaeng_rooms')
      .select('id, code, players, profiles!host_id(username)')
      .eq('phase','LOBBY')
      .order('created_at', { ascending:false })
      .limit(20)
    if (data) setLobbyList(data.map((r:any) => ({
      id: r.id, code: r.code,
      count: r.players?.length ?? 0,
      hostName: r.profiles?.username ?? '—',
    })))
  }

  // ── Subscribe ────────────────────────────────────────────────────────────
  const subscribe = useCallback((roomId:string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`kaeng:${roomId}`, { config:{ presence:{ key: profile?.id ?? '' } } })
      .on('postgres_changes', {
        event:'*', schema:'public', table:'kaeng_rooms', filter:`id=eq.${roomId}`,
      }, ({ new:raw }) => {
        const r = raw as any; if (!r?.id) return
        const parsed = parseRoom(r)
        setRoom(parsed)
        if (profile && !parsed.players.find(p=>p.id===profile.id)) {
          toast_('คุณถูกเตะออกจากห้อง')
          channelRef.current && supabase.removeChannel(channelRef.current)
          setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby(); return
        }
        if (r.phase==='RESULT' && profile) {
          const me = parsed.players.find(p=>p.id===profile.id)
          setTimeout(() => {
            if (me && me.netChange > 0) play('win')
            else if (me && me.netChange < 0) play('lose')
          }, RESULT_DELAY)
        }
      })
      .on('broadcast', { event:'chat' }, ({ payload }) => {
        setChatLog(prev => [...prev.slice(-99), payload])
      })
      .on('presence', { event:'sync' }, () => {
        const ids = new Set(Object.keys(ch.presenceState()))
        setRoom(prev => prev
          ? { ...prev, players: prev.players.map(p=>({...p, isOnline: ids.has(p.id)})) }
          : prev
        )
      })
      .subscribe(async s => { if (s==='SUBSCRIBED') await ch.track({ userId: profile?.id }) })
    channelRef.current = ch
  }, [profile])

  const parseRoom = (d:any): Room => ({
    id: d.id, code: d.code, hostId: d.host_id,
    phase: d.phase, players: d.players ?? [], roundNumber: d.round_number ?? 1,
  })

  const dbUpdate = async (patch: Record<string,unknown>) => {
    if (!roomRef.current) return
    await supabase.from('kaeng_rooms').update(patch).eq('id', roomRef.current.id)
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const me: Player = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น', avatar_url: profile.avatar_url ?? null,
      balance: profile.balance, cards: [], bet: 0, action: 'IDLE', netChange: 0, results: {}, isOnline: true,
    }
    const { data, error } = await supabase.from('kaeng_rooms').insert([{
      code: genCode(), host_id: profile.id, phase: 'LOBBY',
      players: [me], round_number: 1,
    }]).select().single()
    if (error || !data) return toast_('สร้างห้องไม่สำเร็จ')
    setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM')
  }

  // ── Join ─────────────────────────────────────────────────────────────────
  const joinRoom = async (id?:string, code?:string) => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const q = supabase.from('kaeng_rooms').select('*')
    const { data, error } = id
      ? await q.eq('id',id).single()
      : await q.eq('code',(code||joinCode).toUpperCase()).single()
    if (error||!data) return toast_('ไม่พบห้อง')
    if ((data.players as Player[]).find(p=>p.id===profile.id)) {
      setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM'); return
    }
    if (data.phase!=='LOBBY') return toast_('เกมเริ่มไปแล้ว')
    if ((data.players as Player[]).length >= MAX_PLAYERS) return toast_('ห้องเต็มแล้ว')
    const me: Player = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น', avatar_url: profile.avatar_url ?? null,
      balance: profile.balance, cards: [], bet: 0, action: 'IDLE', netChange: 0, results: {}, isOnline: true,
    }
    const updated = [...data.players, me]
    await supabase.from('kaeng_rooms').update({ players: updated }).eq('id', data.id)
    setRoom(parseRoom({ ...data, players:updated })); subscribe(data.id); setScreen('ROOM')
  }

  // ── Leave ────────────────────────────────────────────────────────────────
  const leaveRoom = async () => {
    if (!room||!profile) return
    const remaining = room.players.filter(p=>p.id!==profile.id)
    if (remaining.length===0) {
      await supabase.from('kaeng_rooms').delete().eq('id', room.id)
    } else {
      await dbUpdate({ players:remaining, host_id: room.hostId===profile.id ? remaining[0].id : room.hostId })
    }
    channelRef.current && supabase.removeChannel(channelRef.current)
    setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby()
  }

  // ── Kick ─────────────────────────────────────────────────────────────────
  const kickPlayer = async (targetId:string) => {
    if (!room||room.hostId!==profile?.id) return
    setKickTarget(null)
    await dbUpdate({ players: room.players.filter(p=>p.id!==targetId) })
  }

  const transferHost = async (newId:string) => {
    if (!room||room.hostId!==profile?.id) return
    await dbUpdate({ host_id: newId }); toast_('โอนหัวหน้าห้องแล้ว')
  }

  // ── Start round ──────────────────────────────────────────────────────────
  const startRound = async () => {
    if (!room||room.hostId!==profile?.id) return
    if (room.players.length < 2) return toast_('ต้องการผู้เล่นอย่างน้อย 2 คน')
    play('shuffle')
    await dbUpdate({
      phase: 'BETTING',
      players: room.players.map(p=>({ ...p, cards:[], bet:0, action:'IDLE', netChange:0, results:{} })),
    })
  }

  // ── Place bet ────────────────────────────────────────────────────────────
  const placeBet = async () => {
    if (!room||!profile) return
    if (betInput < MIN_BET || betInput > profile.balance) return toast_('จำนวนเงินไม่ถูกต้อง')
    const updated = room.players.map(p =>
      p.id===profile.id ? { ...p, bet:betInput, action:'BET_PLACED' as PlayerAction } : p
    )
    await dbUpdate({ players:updated })
    // host แจกไพ่ถ้าทุกคนเดิมพันครบ
    if (updated.every(p=>p.action==='BET_PLACED') && room.hostId===profile.id) {
      await dealCards(updated)
    }
  }

  // ── Deal cards ───────────────────────────────────────────────────────────
  const dealCards = async (players: Player[]) => {
    if (!roomRef.current) return
    play('shuffle')
    // แจก 2 ใบให้ทุกคน
    const dealt = players.map(p => {
      const cards = [makeCard(), makeCard()]
      // ก้าว/แปด → DONE ทันที
      if (isKaao(cards) || isPaet(cards)) return { ...p, cards, action:'DONE' as PlayerAction }
      return { ...p, cards, action:'DECIDING' as PlayerAction }
    })
    const allDone = dealt.every(p=>p.action==='DONE')
    await dbUpdate({ phase: allDone ? 'RESULT' : 'PLAYING', players:dealt })
    if (allDone) await settleGame(dealt)
  }

  // ── Player: Hit ──────────────────────────────────────────────────────────
  const playerHit = async () => {
    if (!room||!profile) return
    play('flip')
    const updated = room.players.map(p =>
      p.id===profile.id ? { ...p, cards:[...p.cards, makeCard()], action:'HIT' as PlayerAction } : p
    )
    await dbUpdate({ players:updated })
    await checkAllActed(updated)
  }

  // ── Player: Stand ────────────────────────────────────────────────────────
  const playerStand = async () => {
    if (!room||!profile) return
    const updated = room.players.map(p =>
      p.id===profile.id ? { ...p, action:'STAND' as PlayerAction } : p
    )
    await dbUpdate({ players:updated })
    await checkAllActed(updated)
  }

  const checkAllActed = async (players: Player[]) => {
    if (!roomRef.current) return
    if (players.every(p=>['STAND','HIT','DONE'].includes(p.action))) {
      await settleGame(players)
    }
  }

  // ── Settle (Tournament) ──────────────────────────────────────────────────
  const settleGame = async (players: Player[]) => {
    if (!roomRef.current) return
    const settled = settleTournament(players)
    await dbUpdate({ phase:'RESULT', players:settled })
    await sleep(RESULT_DELAY)

    // อัปเดต balance
    for (const p of settled) {
      const { data:curr } = await supabase.from('profiles').select('balance').eq('id',p.id).single()
      if (!curr) continue
      // สุทธิ = netChange (บวก = ได้รับ, ลบ = เสีย) แต่ยังต้องหัก bet ออกก่อนแล้วคืนถ้าชนะ
      // บัญชีง่าย: balance + netChange (netChange คำนวณมาแล้วสุทธิ ไม่รวม bet)
      await supabase.from('profiles').update({ balance: curr.balance + p.netChange }).eq('id',p.id)
      await supabase.from('game_logs').insert([{
        user_id: p.id, game_name:'Kaeng-Multi',
        change_amount: p.netChange,
        result: `${p.netChange>=0?'ได้':'เสีย'} $${Math.abs(p.netChange)} · แต้ม ${calcScore(p.cards)}`,
      }])
    }
    syncUser()
  }

  // ── Next round ───────────────────────────────────────────────────────────
  const nextRound = async () => {
    if (!room||room.hostId!==profile?.id) return
    await dbUpdate({
      phase:'LOBBY', round_number: room.roundNumber+1,
      players: room.players.map(p=>({ ...p, cards:[], bet:0, action:'IDLE', netChange:0, results:{} })),
    })
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()||!room||!profile) return
    const payload = { uid:profile.id, name:profile.username??'ผู้เล่น', msg:chatInput.trim() }
    setChatLog(prev=>[...prev.slice(-99), payload])
    setChatInput('')
    await channelRef.current?.send({ type:'broadcast', event:'chat', payload })
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const me       = room?.players.find(p=>p.id===profile?.id)
  const isHost   = room?.hostId===profile?.id
  const isMyTurn = room?.phase==='PLAYING' && me?.action==='DECIDING'
  const allBet   = (room?.players.length??0) > 0 && room?.players.every(p=>p.action==='BET_PLACED')
  const waitCount = room?.players.filter(p=>p.action==='DECIDING').length ?? 0

  // ══════════════════════════════════════════════════════════════════════════
  //  LIST SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (screen==='LIST') return (
    <div className="min-h-screen bg-[#080b12] text-white"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={()=>router.push('/games/kaeng/select')}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition text-lg">←</button>
          <div>
            <h1 className="text-2xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 tracking-tight">ไพ่แคง</h1>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Multiplayer · Tournament · ไม่มีเจ้ามือ</p>
          </div>
        </div>

        {/* Create */}
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">สร้างห้องใหม่</h2>
          <p className="text-xs text-gray-600 font-bold">ทุกคนวัดแต้มกันเอง ชนะได้จากหลายคนพร้อมกัน</p>
          <button onClick={createRoom}
            className="py-3 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 rounded-xl font-black text-base transition active:scale-95">
            🏆 สร้างห้อง
          </button>
        </div>

        {/* Join */}
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">เข้าด้วยรหัส</h2>
          <div className="flex gap-2">
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e=>e.key==='Enter'&&joinRoom(undefined,joinCode)}
              placeholder="A1B2C3" maxLength={6}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-black text-center tracking-[.3em] text-lg focus:outline-none focus:border-purple-500 uppercase" />
            <button onClick={()=>joinRoom(undefined,joinCode)}
              className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition text-sm">
              เข้าร่วม
            </button>
          </div>
        </div>

        {/* Room list */}
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
  //  ROOM SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (!room) return null

  return (
    <div className="min-h-screen bg-[#080b12] text-white flex flex-col"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>

      <style>{`
        @keyframes cardDeal {
          from { opacity:0; transform:translateY(-50px) rotate(-12deg) scale(.8) }
          to   { opacity:1; transform:translateY(0) rotate(0) scale(1) }
        }
        .card-deal { animation: cardDeal .35s cubic-bezier(.22,1,.36,1) both }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,.4)} 50%{box-shadow:0 0 0 8px rgba(168,85,247,0)} }
        .glow-me { animation: glowPulse 1.6s ease infinite }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .slide-up { animation: slideUp .45s ease forwards }
        .scr::-webkit-scrollbar{width:3px}
        .scr::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
      `}</style>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Kick modal */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 w-72 shadow-2xl">
            <span className="text-3xl">🚫</span>
            <p className="font-black text-white text-center">
              เตะ <span className="text-red-400">{room.players.find(p=>p.id===kickTarget)?.username}</span> ออก?
            </p>
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
          <PhaseBadge phase={room.phase} />
        </div>
        <div className="text-xs text-gray-600 font-bold shrink-0">{room.players.length}/{MAX_PLAYERS}</div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ═══ GAME BOARD ═════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-y-auto scr p-4 gap-4">

          {/* Players grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {room.players.map(p => {
              const isMe = p.id===profile?.id
              const myTurn = room.phase==='PLAYING' && isMe && p.action==='DECIDING'
              // เห็นไพ่ตัวเองเสมอ เห็นคนอื่นตอน RESULT
              const showCards = isMe || room.phase==='RESULT'
              const showResult = room.phase==='RESULT' && resultVisible
              const score = p.cards.length>0 ? calcScore(p.cards) : null
              const { label:bonus } = p.cards.length>=2 ? getHandBonus(p.cards) : { label:'' }

              // สรุปผลกับผู้เล่นคนนี้ (ตอน RESULT)
              const myResultVsThis = isMe ? null : (me?.results[p.id] ?? null)

              return (
                <div key={p.id} className={`relative rounded-xl border p-3 flex flex-col gap-2 transition-all duration-200
                  ${myTurn ? 'border-purple-500/60 bg-purple-950/20 glow-me' : ''}
                  ${isMe && !myTurn ? 'border-purple-500/20 bg-black/50' : ''}
                  ${!isMe ? 'border-white/8 bg-black/40' : ''}
                  ${showResult && p.netChange>0 ? 'border-green-500/30' : ''}
                  ${showResult && p.netChange<0 ? 'border-red-500/20 opacity-75' : ''}
                `}>

                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <Avatar url={p.avatar_url} name={p.username} size={28} online={p.isOnline} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>
                        {p.username}{isMe?' (คุณ)':''} {p.id===room.hostId?' 👑':''}
                      </p>
                      <p className="text-[10px] text-gray-600">${p.balance.toLocaleString()}</p>
                    </div>
                    {p.bet>0 && room.phase!=='RESULT' && (
                      <span className="text-[10px] text-yellow-400 font-black shrink-0">${p.bet}</span>
                    )}
                    {!isMe && myResultVsThis && showResult && (
                      <VsBadge result={myResultVsThis} />
                    )}
                    {isHost && !isMe && room.phase==='LOBBY' && (
                      <button onClick={()=>setKickTarget(p.id)}
                        className="text-[10px] text-gray-700 hover:text-red-400 transition font-black shrink-0">✕</button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex gap-1.5 justify-center">
                    {p.cards.length===0
                      ? <div className="w-full h-[64px] rounded-lg border border-white/5 bg-black/20" />
                      : p.cards.map((c,i)=><CardSm key={i} card={c} hidden={!showCards}/>)
                    }
                  </div>

                  {/* Score / status */}
                  <div className="flex items-center justify-center gap-1.5 min-h-[18px]">
                    {/* แสดงแต้ม */}
                    {score!==null && showCards && !showResult && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        {score} แต้ม{bonus?` · ${bonus}`:''}
                      </span>
                    )}
                    {/* แสดงผลตอน RESULT */}
                    {showResult && (
                      <span className={`text-xs font-black ${p.netChange>0?'text-green-400':p.netChange<0?'text-red-400':'text-yellow-400'}`}>
                        {score} แต้ม · {p.netChange>0?`+$${p.netChange}`:p.netChange<0?`-$${Math.abs(p.netChange)}`:'±0'}
                        {bonus?` · ${bonus}`:''}
                      </span>
                    )}
                    {/* action status */}
                    {!showResult && p.action==='STAND'      && <span className="text-[10px] text-blue-400   font-black">✋ หยุด</span>}
                    {!showResult && p.action==='HIT'        && <span className="text-[10px] text-purple-400  font-black">🃏 จั่ว</span>}
                    {!showResult && p.action==='BET_PLACED' && room.phase==='BETTING'
                      && <span className="text-[10px] text-green-400 font-black">✅ ${p.bet}</span>}
                    {!showResult && p.action==='IDLE'       && room.phase==='BETTING'
                      && <span className="text-[10px] text-gray-600 font-bold animate-pulse">รอเดิมพัน...</span>}
                    {!showResult && p.action==='DONE'       && room.phase==='PLAYING'
                      && <span className="text-[10px] text-green-500 font-black">✔ พร้อม</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Control panel ──────────────────────────────────────────── */}
          <div className="bg-black/70 border border-white/8 rounded-2xl p-4">

            {/* LOBBY */}
            {room.phase==='LOBBY' && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-bold mb-1">รหัสห้อง</p>
                  <p className="text-yellow-400 font-black text-3xl tracking-[.3em]">{room.code}</p>
                </div>
                <p className="text-xs text-purple-400 font-bold text-center">🏆 ทุกคนวัดกันเองทุกคู่ — ชนะได้จากหลายคน</p>
                {isHost
                  ? <button onClick={startRound} disabled={room.players.length<2}
                      className="w-full max-w-xs py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                      {room.players.length<2?`รอผู้เล่น (${room.players.length}/2)`:'🃏 เริ่มรอบ!'}
                    </button>
                  : <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้องเริ่มเกม...</p>
                }
              </div>
            )}

            {/* BETTING — ยังไม่เดิมพัน */}
            {room.phase==='BETTING' && me?.action!=='BET_PLACED' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/8">
                  <span className="text-gray-500 text-sm font-bold">เดิมพัน (วัดกับทุกคน)</span>
                  <span className="text-yellow-400 font-black text-2xl">${betInput}</span>
                </div>
                <div className="flex gap-2">
                  {[10,50,100,500].map(v=>(
                    <button key={v} onClick={()=>setBetInput(b=>b+v)}
                      className="flex-1 py-2 bg-white/5 rounded-lg font-black text-sm hover:bg-yellow-500 hover:text-black transition">+{v}</button>
                  ))}
                  <button onClick={()=>setBetInput(MIN_BET)} className="px-3 py-2 bg-red-900/30 text-red-400 rounded-lg font-black text-sm">↺</button>
                </div>
                <button onClick={placeBet}
                  className="py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-base transition active:scale-95">
                  ✅ ยืนยัน ${betInput}
                </button>
              </div>
            )}

            {/* BETTING — เดิมพันแล้ว */}
            {room.phase==='BETTING' && me?.action==='BET_PLACED' && (
              <div className="text-center py-3">
                <p className="text-gray-500 font-black animate-pulse text-sm">
                  รอผู้เล่นอื่น... ({room.players.filter(p=>p.action==='BET_PLACED').length}/{room.players.length})
                </p>
                {isHost && allBet && (
                  <button onClick={()=>dealCards(room.players)}
                    className="mt-3 px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl transition text-sm">
                    🃏 แจกไพ่เลย!
                  </button>
                )}
              </div>
            )}

            {/* PLAYING — ตาฉัน */}
            {isMyTurn && (
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs text-purple-300 font-black uppercase tracking-wider animate-pulse">⭐ ตาของคุณ — {calcScore(me.cards)} แต้ม</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={playerHit} disabled={(me?.cards.length??0)>=3}
                    className="py-4 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                    🃏 จั่วไพ่
                  </button>
                  <button onClick={playerStand}
                    className="py-4 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-xl text-lg transition active:scale-95">
                    ✋ พอแล้ว
                  </button>
                </div>
              </div>
            )}

            {/* PLAYING — รอ */}
            {room.phase==='PLAYING' && !isMyTurn && (
              <p className="text-center text-gray-600 font-black animate-pulse text-sm py-2">
                {me?.action==='STAND'?'✋ คุณหยุดแล้ว':me?.action==='HIT'?'🃏 จั่วแล้ว':'รอ...'}
                {waitCount>0?` รอผู้เล่นอีก ${waitCount} คน`:''}
              </p>
            )}

            {/* RESULT — รอ */}
            {room.phase==='RESULT' && !resultVisible && (
              <p className="text-center text-gray-600 font-bold animate-pulse text-sm py-2">กำลังนับแต้ม...</p>
            )}

            {/* RESULT — แสดงผล */}
            {room.phase==='RESULT' && resultVisible && (
              <div className="flex flex-col items-center gap-4 slide-up">
                {/* ผลรวมของตัวเอง */}
                {me && (
                  <div className="text-center">
                    <p className={`text-xl md:text-2xl font-black ${me.netChange>0?'text-green-400':me.netChange<0?'text-red-400':'text-yellow-400'}`}>
                      {me.netChange>0?`🏆 ได้รับ +$${me.netChange}`:me.netChange<0?`💀 เสีย -$${Math.abs(me.netChange)}`:'🤝 เสมอทุกคู่'}
                    </p>
                    <p className="text-gray-500 text-xs font-bold mt-1">{calcScore(me.cards)} แต้ม{(()=>{ const {label}=getHandBonus(me.cards); return label?` · ${label}`:''; })()}</p>
                  </div>
                )}

                {/* ผลกับแต่ละคน */}
                {me && (
                  <div className="w-full flex flex-col gap-1.5">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-widest text-center mb-1">ผลกับผู้เล่นแต่ละคน</p>
                    {room.players.filter(p=>p.id!==me.id).map(p=>{
                      const res = me.results[p.id]
                      const { mult:theirMult } = getHandBonus(p.cards)
                      const pay = res==='WIN' ? Math.min(me.bet*getHandBonus(me.cards).mult, p.bet)
                               : res==='LOSE' ? -Math.min(p.bet*theirMult, me.bet)
                               : 0
                      return (
                        <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold
                          ${res==='WIN' ?'border-green-500/25 bg-green-900/10':
                            res==='LOSE'?'border-red-500/20 bg-red-900/10 opacity-80':
                            'border-white/8 bg-white/3'}`}>
                          <Avatar url={p.avatar_url} name={p.username} size={22}/>
                          <span className="flex-1 truncate font-black text-white">{p.username}</span>
                          <span className="text-gray-500">{calcScore(p.cards)} แต้ม</span>
                          {res && <VsBadge result={res}/>}
                          <span className={pay>0?'text-green-400':pay<0?'text-red-400':'text-yellow-400'}>
                            {pay>0?`+$${pay}`:pay<0?`-$${Math.abs(pay)}`:'±0'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {isHost
                  ? <button onClick={nextRound}
                      className="px-8 py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl text-base transition active:scale-95">
                      🔄 รอบถัดไป
                    </button>
                  : <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้อง...</p>
                }
              </div>
            )}
          </div>
        </div>

        {/* ═══ SIDEBAR ════════════════════════════════════════════════════ */}
        <div className="hidden md:flex w-60 border-l border-white/5 flex-col bg-black/30 shrink-0">

          {/* Players */}
          <div className="p-4 border-b border-white/5">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">ผู้เล่น</p>
            <div className="flex flex-col gap-2.5">
              {room.players.map(p=>(
                <div key={p.id} className="flex items-center gap-2 group">
                  <Avatar url={p.avatar_url} name={p.username} size={28} online={p.isOnline}/>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${p.id===profile?.id?'text-purple-300':'text-white'}`}>
                      {p.username}{p.id===room.hostId?' 👑':''}
                    </p>
                    <p className="text-[10px] text-gray-700">${p.balance.toLocaleString()}</p>
                  </div>
                  {isHost && p.id!==profile?.id && room.phase==='LOBBY' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={()=>transferHost(p.id)} title="โอนหัวหน้า"
                        className="text-[10px] text-gray-600 hover:text-yellow-400 transition">👑</button>
                      <button onClick={()=>setKickTarget(p.id)} title="เตะออก"
                        className="text-[10px] text-gray-600 hover:text-red-400 transition">✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col p-4 min-h-0">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-2">💬 แชท</p>
            <div className="flex-1 overflow-y-auto scr flex flex-col gap-1 min-h-0 mb-3">
              {chatLog.length===0
                ? <p className="text-center text-gray-800 text-xs mt-4">ยังไม่มีข้อความ</p>
                : chatLog.map((c,i)=>(
                  <p key={i} className="text-xs leading-snug">
                    <span className={`font-black ${c.uid===profile?.id?'text-purple-300':'text-yellow-500/80'}`}>{c.name}: </span>
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
              <button onClick={sendChat}
                className="px-2.5 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-xs font-black transition">↵</button>
            </div>
          </div>

          {/* Rules */}
          <div className="p-4 border-t border-white/5">
            <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-2">กติกา</p>
            <div className="space-y-1 text-[11px] text-gray-600 font-bold">
              <p><span className="text-yellow-600">วิธีชนะ</span> — แต้มสูงกว่าทุกคนที่วัดด้วย</p>
              <p><span className="text-yellow-600">ก้าว 9</span> — ชนะทันที เปิดไพ่เลย</p>
              <p><span className="text-yellow-600">แปด 8</span> — เปิดวัดกันทันที</p>
              <p><span className="text-yellow-600">แคง</span> — หน้าเดียวกัน จ่าย ×2</p>
              <p><span className="text-yellow-600">ดอกเดียว</span> — ดอกเดียวกัน จ่าย ×2</p>
              <div className="pt-1 mt-1 border-t border-white/5 text-gray-700">
                <p>ชนะ = ได้ bet ของคนแพ้</p>
                <p>แพ้ = เสีย bet ตัวเอง</p>
                <p>เสมอ = ไม่มีการจ่าย</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
