// src/app/games/pokdeng/multiplayer/page.tsx
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Constants ─────────────────────────────────────────────────────────────────
const SUITS  = ['♠', '♥', '♦', '♣'] as const
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const
const MAX_PLAYERS    = 6
const MIN_BET        = 10
const RESULT_DELAY   = 2200   // ms ก่อนจะ settle (ให้เห็นไพ่ก่อน)
const NEXT_RND_DELAY = 3500   // ms ก่อนเปลี่ยน phase ถัดไปอัตโนมัติ

// ─── Types ─────────────────────────────────────────────────────────────────────
type Card         = { suit: string; value: string; score: number }
type PlayerAction = 'IDLE' | 'BET_PLACED' | 'DECIDING' | 'STAND' | 'HIT' | 'DONE'
type PlayerResult = 'WIN' | 'LOSE' | 'DRAW' | null
type RoomPhase    = 'LOBBY' | 'BETTING' | 'PLAYER_TURNS' | 'BANKER_TURN' | 'RESULT'

interface Player {
  id:           string
  username:     string
  avatar_url:   string | null
  balance:      number
  cards:        Card[]
  bet:          number
  action:       PlayerAction
  result:       PlayerResult
  resultDetail: string
  netChange:    number          // +/- หลังจบรอบ
  isOnline:     boolean
}

interface Room {
  id:           string
  code:         string
  hostId:       string
  bankerId:     string
  phase:        RoomPhase
  players:      Player[]
  bankerCards:  Card[]
  bankerAction: 'IDLE' | 'DECIDING' | 'HIT' | 'STAND' | 'DONE'
  roundNumber:  number
  rotateBanker: boolean
}

// ─── Pure helpers ───────────────────────────────────────────────────────────────
const makeCard = (): Card => {
  const suit  = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]
  const score = value === 'A' ? 1 : ['10','J','Q','K'].includes(value) ? 0 : parseInt(value)
  return { suit, value, score }
}
const calcScore = (cards: Card[]) => cards.reduce((s,c) => s + c.score, 0) % 10
const isPok     = (cards: Card[]) => cards.length === 2 && calcScore(cards) >= 8
const genCode   = () => Math.random().toString(36).substring(2,8).toUpperCase()
const isRed     = (suit: string) => suit === '♥' || suit === '♦'
const sleep     = (ms: number)   => new Promise(r => setTimeout(r, ms))

function getHandInfo(cards: Card[]): { mult: number; label: string } {
  if (cards.length === 2) {
    if (cards[0].suit === cards[1].suit || cards[0].value === cards[1].value)
      return { mult: 2, label: '2 เด้ง' }
  } else if (cards.length === 3) {
    const vals = cards.map(c => c.value).sort()
    if (new Set(vals).size === 1)                         return { mult: 5, label: 'ตอง' }
    if (new Set(cards.map(c => c.suit)).size === 1)       return { mult: 3, label: '3 เด้ง' }
    if (vals.every(v => ['J','Q','K'].includes(v)))       return { mult: 3, label: 'เซียน' }
  }
  return { mult: 1, label: 'ปกติ' }
}

function resolveResult(pCards: Card[], bCards: Card[]): { result: PlayerResult; detail: string; mult: number } {
  const ps = calcScore(pCards), bs = calcScore(bCards)
  const { label, mult } = getHandInfo(pCards)
  if (ps > bs) return { result: 'WIN',  detail: label, mult }
  if (ps < bs) return { result: 'LOSE', detail: label, mult }
  return         { result: 'DRAW', detail: 'เสมอ',    mult }
}

// ─── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 32, online }: { url: string|null; name: string; size?: number; online?: boolean }) {
  const initials = name.charAt(0).toUpperCase()
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <Image
          src={url} alt={name} fill
          className="rounded-full object-cover border-2 border-white/10"
          unoptimized
        />
      ) : (
        <div
          className="rounded-full bg-gradient-to-br from-purple-700 to-purple-900 flex items-center justify-center font-black text-white border-2 border-white/10"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#080b12] ${online ? 'bg-green-400' : 'bg-gray-600'}`} />
      )}
    </div>
  )
}

// ─── Card UI ────────────────────────────────────────────────────────────────────
function CardSm({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (!card || hidden)
    return <div className="w-[48px] h-[68px] rounded-lg border-2 border-purple-500/40 bg-[#1a0a2e] flex items-center justify-center text-purple-400 text-lg font-bold card-deal">★</div>
  return (
    <div className="w-[48px] h-[68px] rounded-lg bg-white flex items-center justify-center font-black text-base border-2 border-yellow-400/50 shadow-md card-deal">
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}

function CardLg({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (!card || hidden)
    return <div className="w-[64px] h-[90px] rounded-xl border-2 border-purple-500/40 bg-[#1a0a2e] flex items-center justify-center text-purple-400 text-2xl font-bold card-deal">★</div>
  return (
    <div className="w-[64px] h-[90px] rounded-xl bg-white flex items-center justify-center font-black text-2xl border-2 border-yellow-400/60 shadow-lg card-deal">
      <span className={isRed(card.suit) ? 'text-red-500' : 'text-gray-900'}>{card.value}{card.suit}</span>
    </div>
  )
}

// ─── Phase Badge ────────────────────────────────────────────────────────────────
function PhaseBadge({ phase }: { phase: RoomPhase }) {
  const cfg: Record<RoomPhase,{label:string;cls:string}> = {
    LOBBY:        { label:'● รอผู้เล่น',      cls:'bg-green-500/15  text-green-400  border-green-500/20'  },
    BETTING:      { label:'💰 วางเดิมพัน',    cls:'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
    PLAYER_TURNS: { label:'🃏 ผู้เล่นตัดสิน', cls:'bg-purple-500/15 text-purple-400 border-purple-500/20' },
    BANKER_TURN:  { label:'🏦 เจ้ามือตัดสิน', cls:'bg-orange-500/15 text-orange-400 border-orange-500/20' },
    RESULT:       { label:'🏆 ผลการแข่ง',     cls:'bg-blue-500/15   text-blue-400   border-blue-500/20'   },
  }
  const { label, cls } = cfg[phase]
  return <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${cls}`}>{label}</span>
}

// ─── Result Overlay ─────────────────────────────────────────────────────────────
function ResultOverlay({ result, netChange, label }: { result: PlayerResult; netChange: number; label: string }) {
  if (!result) return null
  const cfg = {
    WIN:  { emoji:'🏆', cls:'text-green-400',  text: `+$${Math.abs(netChange)}` },
    LOSE: { emoji:'💀', cls:'text-red-400',    text: `-$${Math.abs(netChange)}` },
    DRAW: { emoji:'🤝', cls:'text-yellow-400', text: 'คืนทุน' },
  }
  const { emoji, cls, text } = cfg[result]
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl z-10 gap-0.5">
      <span className="text-xl">{emoji}</span>
      <span className={`text-xs font-black ${cls}`}>{text}</span>
      {label !== 'ปกติ' && label !== 'เสมอ' && (
        <span className="text-[10px] text-gray-400 font-bold">{label}</span>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════════
export default function PokDengMultiplayer() {
  const router    = useRouter()
  const { profile, syncUser } = useUser()

  const [screen,     setScreen]     = useState<'LIST'|'ROOM'>('LIST')
  const [lobbyList,  setLobbyList]  = useState<{id:string;code:string;count:number;hostName:string}[]>([])
  const [joinCode,   setJoinCode]   = useState('')
  const [rotateBanker, setRotateBanker] = useState(true)

  const [room,    setRoom]    = useState<Room | null>(null)
  const roomRef               = useRef<Room | null>(null)
  const channelRef            = useRef<RealtimeChannel | null>(null)

  const [betInput,   setBetInput]   = useState(MIN_BET)
  const [toast,      setToast]      = useState('')
  const [chatInput,  setChatInput]  = useState('')
  const [chatLog,    setChatLog]    = useState<{uid:string;name:string;msg:string}[]>([])
  const [kickTarget, setKickTarget] = useState<string|null>(null)  // playerId กำลังจะเตะ
  const [resultVisible, setResultVisible] = useState(false)        // ดีเลย์แสดงผล
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const sfx = useRef<Record<string, HTMLAudioElement>>({})
  useEffect(() => {
    sfx.current.flip    = new Audio('/sounds/Card-flip.wav')
    sfx.current.win     = new Audio('/sounds/Win.wav')
    sfx.current.lose    = new Audio('/sounds/Lose.wav')
    sfx.current.shuffle = new Audio('/sounds/Card-shuffle.wav')
    fetchLobby()
  }, [])

  const play   = (k: string) => { const a = sfx.current[k]; if (a) { a.currentTime=0; a.play().catch(()=>{}) } }
  const toast_ = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => { roomRef.current = room }, [room])
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chatLog])

  // เมื่อ phase เปลี่ยนเป็น RESULT ให้รอ delay ก่อนแสดงผล
  useEffect(() => {
    if (room?.phase === 'RESULT') {
      setResultVisible(false)
      const t = setTimeout(() => setResultVisible(true), RESULT_DELAY)
      return () => clearTimeout(t)
    } else {
      setResultVisible(false)
    }
  }, [room?.phase])

  // ── Fetch lobby ────────────────────────────────────────────────────────────
  const fetchLobby = async () => {
    const { data } = await supabase
      .from('pokdeng_rooms')
      .select('id, code, players, profiles!host_id(username)')
      .eq('phase','LOBBY')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setLobbyList(data.map((r:any) => ({
      id: r.id, code: r.code,
      count: r.players?.length ?? 0,
      hostName: r.profiles?.username ?? '—',
    })))
  }

  // ── Subscribe ──────────────────────────────────────────────────────────────
  const subscribe = useCallback((roomId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase
      .channel(`pokdeng:${roomId}`, { config: { presence: { key: profile?.id ?? '' } } })
      .on('postgres_changes', {
        event: '*', schema:'public', table:'pokdeng_rooms', filter:`id=eq.${roomId}`,
      }, ({ new: raw }) => {
        const r = raw as any
        if (!r?.id) return
        const parsed: Room = {
          id: r.id, code: r.code, hostId: r.host_id, bankerId: r.banker_id,
          phase: r.phase, players: r.players ?? [], bankerCards: r.banker_cards ?? [],
          bankerAction: r.banker_action ?? 'IDLE', roundNumber: r.round_number ?? 1,
          rotateBanker: r.rotate_banker ?? true,
        }
        setRoom(parsed)

        // ถูกเตะออก
        if (profile && !parsed.players.find(p => p.id === profile.id)) {
          toast_('คุณถูกเตะออกจากห้อง')
          channelRef.current && supabase.removeChannel(channelRef.current)
          setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby()
          return
        }

        if (r.phase === 'RESULT' && profile) {
          const me = parsed.players.find(p => p.id === profile.id)
          setTimeout(() => {
            if (me?.result === 'WIN') play('win')
            else if (me?.result === 'LOSE') play('lose')
          }, RESULT_DELAY)
        }
      })
      .on('broadcast', { event:'chat' }, ({ payload }) => {
        setChatLog(prev => [...prev.slice(-99), payload])
      })
      .on('presence', { event:'sync' }, () => {
        const ids = new Set(Object.keys(ch.presenceState()))
        setRoom(prev => prev
          ? { ...prev, players: prev.players.map(p => ({ ...p, isOnline: ids.has(p.id) })) }
          : prev
        )
      })
      .subscribe(async s => {
        if (s === 'SUBSCRIBED') await ch.track({ userId: profile?.id })
      })

    channelRef.current = ch
  }, [profile])

  // ── DB helper ──────────────────────────────────────────────────────────────
  const dbUpdate = async (patch: Record<string,unknown>) => {
    if (!roomRef.current) return
    await supabase.from('pokdeng_rooms').update(patch).eq('id', roomRef.current.id)
  }

  // ── Parse raw DB row → Room ────────────────────────────────────────────────
  const parseRoom = (d: any): Room => ({
    id: d.id, code: d.code, hostId: d.host_id, bankerId: d.banker_id,
    phase: d.phase, players: d.players ?? [], bankerCards: d.banker_cards ?? [],
    bankerAction: d.banker_action ?? 'IDLE', roundNumber: d.round_number ?? 1,
    rotateBanker: d.rotate_banker ?? true,
  })

  // ── Create room ────────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const me: Player = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น',
      avatar_url: profile.avatar_url ?? null,
      balance: profile.balance, cards: [], bet: 0,
      action: 'IDLE', result: null, resultDetail: '', netChange: 0, isOnline: true,
    }
    const { data, error } = await supabase.from('pokdeng_rooms').insert([{
      code: genCode(), host_id: profile.id, banker_id: profile.id,
      phase: 'LOBBY', players: [me], banker_cards: [], banker_action: 'IDLE',
      round_number: 1, rotate_banker: rotateBanker,
    }]).select().single()
    if (error || !data) return toast_('สร้างห้องไม่สำเร็จ')
    setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM')
  }

  // ── Join room ──────────────────────────────────────────────────────────────
  const joinRoom = async (id?: string, code?: string) => {
    if (!profile) return toast_('กรุณาล็อกอินก่อน')
    const q = supabase.from('pokdeng_rooms').select('*')
    const { data, error } = id
      ? await q.eq('id', id).single()
      : await q.eq('code', (code || joinCode).toUpperCase()).single()
    if (error || !data) return toast_('ไม่พบห้อง')

    // reconnect
    if ((data.players as Player[]).find(p => p.id === profile.id)) {
      setRoom(parseRoom(data)); subscribe(data.id); setScreen('ROOM'); return
    }
    if (data.phase !== 'LOBBY') return toast_('เกมเริ่มไปแล้ว')
    if ((data.players as Player[]).length >= MAX_PLAYERS) return toast_('ห้องเต็มแล้ว')

    const me: Player = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น',
      avatar_url: profile.avatar_url ?? null,
      balance: profile.balance, cards: [], bet: 0,
      action: 'IDLE', result: null, resultDetail: '', netChange: 0, isOnline: true,
    }
    const updated = [...data.players, me]
    await supabase.from('pokdeng_rooms').update({ players: updated }).eq('id', data.id)
    setRoom(parseRoom({ ...data, players: updated })); subscribe(data.id); setScreen('ROOM')
  }

  // ── Leave room ─────────────────────────────────────────────────────────────
  const leaveRoom = async () => {
    if (!room || !profile) return
    const remaining = room.players.filter(p => p.id !== profile.id)
    if (remaining.length === 0) {
      await supabase.from('pokdeng_rooms').delete().eq('id', room.id)
    } else {
      await dbUpdate({
        players: remaining,
        host_id:   room.hostId   === profile.id ? remaining[0].id : room.hostId,
        banker_id: room.bankerId === profile.id ? remaining[0].id : room.bankerId,
      })
    }
    channelRef.current && supabase.removeChannel(channelRef.current)
    setRoom(null); setChatLog([]); setScreen('LIST'); fetchLobby()
  }

  // ── Kick player (host only) ────────────────────────────────────────────────
  const kickPlayer = async (targetId: string) => {
    if (!room || room.hostId !== profile?.id || targetId === profile.id) return
    setKickTarget(null)
    const remaining = room.players.filter(p => p.id !== targetId)
    await dbUpdate({
      players:   remaining,
      banker_id: room.bankerId === targetId ? remaining[0].id : room.bankerId,
    })
  }

  // ── Transfer host ──────────────────────────────────────────────────────────
  const transferHost = async (newHostId: string) => {
    if (!room || room.hostId !== profile?.id) return
    await dbUpdate({ host_id: newHostId })
    toast_('โอนหัวหน้าห้องแล้ว')
  }

  // ── Start round ────────────────────────────────────────────────────────────
  const startRound = async () => {
    if (!room || room.hostId !== profile?.id) return
    if (room.players.length < 2) return toast_('ต้องการผู้เล่นอย่างน้อย 2 คน')
    play('shuffle')
    await dbUpdate({
      phase: 'BETTING',
      players: room.players.map(p => ({ ...p, cards:[], bet:0, action:'IDLE', result:null, resultDetail:'', netChange:0 })),
      banker_cards: [], banker_action: 'IDLE',
    })
  }

  // ── Place bet ──────────────────────────────────────────────────────────────
  const placeBet = async () => {
    if (!room || !profile || profile.id === room.bankerId) return
    if (betInput < MIN_BET || betInput > profile.balance) return toast_('จำนวนเงินไม่ถูกต้อง')
    const updated = room.players.map(p =>
      p.id === profile.id ? { ...p, bet: betInput, action: 'BET_PLACED' as PlayerAction } : p
    )
    await dbUpdate({ players: updated })
    const nb = updated.filter(p => p.id !== room.bankerId)
    if (nb.every(p => p.action === 'BET_PLACED') && room.hostId === profile.id) {
      await dealCards(updated)
    }
  }

  // ── Deal cards ─────────────────────────────────────────────────────────────
  const dealCards = async (players: Player[]) => {
    if (!roomRef.current) return
    play('shuffle')
    const bCards = [makeCard(), makeCard()]
    const bPok   = isPok(bCards)
    const { bankerId } = roomRef.current

    const dealt = players.map(p => {
      if (p.id === bankerId) return { ...p, cards:[], action:'IDLE' as PlayerAction }
      const cards = [makeCard(), makeCard()]
      if (bPok || isPok(cards)) {
        const { result, detail, mult } = resolveResult(cards, bCards)
        const netChange = result === 'WIN' ? p.bet * mult : result === 'LOSE' ? -(p.bet * mult) : 0
        return { ...p, cards, action:'DONE' as PlayerAction, result, resultDetail: detail, netChange }
      }
      return { ...p, cards, action:'DECIDING' as PlayerAction }
    })

    const allDone = dealt.filter(p => p.id !== bankerId).every(p => p.action === 'DONE')
    await dbUpdate({
      phase:         allDone ? 'RESULT' : 'PLAYER_TURNS',
      players:       dealt,
      banker_cards:  bCards,
      banker_action: allDone ? 'DONE' : 'DECIDING',
    })
    if (allDone) await settleGame(dealt, bCards)
  }

  // ── Player Hit ─────────────────────────────────────────────────────────────
  const playerHit = async () => {
    if (!room || !profile) return
    play('flip')
    const updated = room.players.map(p =>
      p.id === profile.id ? { ...p, cards:[...p.cards, makeCard()], action:'HIT' as PlayerAction } : p
    )
    await dbUpdate({ players: updated })
    await checkAllActed(updated)
  }

  // ── Player Stand ───────────────────────────────────────────────────────────
  const playerStand = async () => {
    if (!room || !profile) return
    const updated = room.players.map(p =>
      p.id === profile.id ? { ...p, action:'STAND' as PlayerAction } : p
    )
    await dbUpdate({ players: updated })
    await checkAllActed(updated)
  }

  const checkAllActed = async (players: Player[]) => {
    if (!roomRef.current) return
    const nb = players.filter(p => p.id !== roomRef.current!.bankerId)
    if (nb.every(p => ['STAND','HIT','DONE'].includes(p.action)))
      await dbUpdate({ phase:'BANKER_TURN', banker_action:'DECIDING' })
  }

  // ── Banker Hit ─────────────────────────────────────────────────────────────
  const bankerHit = async () => {
    if (!room || profile?.id !== room.bankerId) return
    play('flip')
    await dbUpdate({ banker_cards: [...room.bankerCards, makeCard()] })
  }

  // ── Banker Stand → Settle ──────────────────────────────────────────────────
  const bankerStand = async () => {
    if (!room || profile?.id !== room.bankerId) return
    await dbUpdate({ banker_action:'STAND' })
    await settleGame(room.players, room.bankerCards)
  }

  // ── Settle game ────────────────────────────────────────────────────────────
  const settleGame = async (players: Player[], bCards: Card[]) => {
    if (!roomRef.current) return
    const { bankerId } = roomRef.current

    // คำนวณผลผู้เล่น
    const resolved = players.map(p => {
      if (p.id === bankerId || p.action === 'DONE') return p
      const { result, detail, mult } = resolveResult(p.cards, bCards)
      const netChange = result === 'WIN' ? p.bet * mult : result === 'LOSE' ? -(p.bet * mult) : 0
      return { ...p, action:'DONE' as PlayerAction, result, resultDetail: detail, netChange }
    })

    // คำนวณ net ของเจ้ามือ
    let bankerNet = 0
    for (const p of resolved) {
      if (p.id === bankerId || !p.result) continue
      bankerNet -= p.netChange   // ผู้เล่นได้ เจ้ามือเสีย / ผู้เล่นเสีย เจ้ามือได้
    }

    // อัปเดต resolved players ให้เจ้ามือมี netChange ด้วย
    const finalPlayers = resolved.map(p =>
      p.id === bankerId ? { ...p, netChange: bankerNet } : p
    )

    await dbUpdate({ phase:'RESULT', players: finalPlayers, banker_action:'DONE' })

    // รอ delay ก่อนอัปเดต DB (ให้ผู้เล่นดูไพ่ก่อน)
    await sleep(RESULT_DELAY)

    // อัปเดต balance ใน DB
    for (const p of finalPlayers) {
      if (p.id === bankerId) continue
      const { mult } = getHandInfo(p.cards)
      const payout = p.result === 'WIN' ? p.bet * (mult+1) : p.result === 'DRAW' ? p.bet : 0
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id',p.id).single()
      if (!curr) continue
      await supabase.from('profiles').update({ balance: curr.balance - p.bet + payout }).eq('id',p.id)
      await supabase.from('game_logs').insert([{
        user_id: p.id, game_name: 'PokDeng-Multi',
        change_amount: payout - p.bet,
        result: p.result === 'WIN' ? `ชนะ +$${p.netChange} (${p.resultDetail})` : p.result === 'DRAW' ? 'เสมอ' : `แพ้ $${p.netChange}`,
      }])
    }
    // Banker
    const { data: bc } = await supabase.from('profiles').select('balance').eq('id',bankerId).single()
    if (bc) {
      await supabase.from('profiles').update({ balance: bc.balance + bankerNet }).eq('id',bankerId)
      await supabase.from('game_logs').insert([{
        user_id: bankerId, game_name:'PokDeng-Multi',
        change_amount: bankerNet,
        result: `เจ้ามือ ${bankerNet >= 0 ? '+' : ''}$${bankerNet}`,
      }])
    }
    syncUser()
  }

  // ── Next round ─────────────────────────────────────────────────────────────
  const nextRound = async () => {
    if (!room || room.hostId !== profile?.id) return
    const idx          = room.players.findIndex(p => p.id === room.bankerId)
    const nextBankerId = room.rotateBanker
      ? room.players[(idx+1) % room.players.length].id
      : room.bankerId
    await dbUpdate({
      phase:        'LOBBY',     // กลับไป LOBBY ก่อน ให้คนเข้า/ออกได้
      banker_id:    nextBankerId,
      round_number: room.roundNumber + 1,
      players: room.players.map(p => ({ ...p, cards:[], bet:0, action:'IDLE', result:null, resultDetail:'', netChange:0 })),
      banker_cards: [], banker_action: 'IDLE',
    })
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || !room || !profile) return
    const payload = { uid: profile.id, name: profile.username ?? 'ผู้เล่น', msg: chatInput.trim() }
    // เพิ่มข้อความตัวเองก่อนเลย ไม่ต้องรอ broadcast ส่งกลับ
    setChatLog(prev => [...prev.slice(-99), payload])
    setChatInput('')
    await channelRef.current?.send({ type: 'broadcast', event: 'chat', payload })
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const me           = room?.players.find(p => p.id === profile?.id)
  const banker       = room?.players.find(p => p.id === room?.bankerId)
  const nonBankers   = room?.players.filter(p => p.id !== room?.bankerId) ?? []
  const isHost       = room?.hostId === profile?.id
  const isBanker     = room?.bankerId === profile?.id
  const isMyTurn     = room?.phase === 'PLAYER_TURNS' && me?.action === 'DECIDING' && !isBanker
  const isBankerTurn = room?.phase === 'BANKER_TURN' && isBanker
  const allBet       = nonBankers.length > 0 && nonBankers.every(p => p.action === 'BET_PLACED')
  const showBankerCards = isBanker || room?.phase === 'BANKER_TURN' || room?.phase === 'RESULT'
  const nextBankerName  = room
    ? room.players[(room.players.findIndex(p => p.id === room.bankerId)+1) % room.players.length]?.username
    : ''

  // ══════════════════════════════════════════════════════════════════════════════
  // LOBBY LIST
  // ══════════════════════════════════════════════════════════════════════════════
  if (screen === 'LIST') return (
    <div className="min-h-screen bg-[#080b12] text-white"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition text-lg">
            ←
          </button>
          <div>
            <h1 className="text-2xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 tracking-tight">Stellar Poker</h1>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">Multiplayer · ผู้เล่นเป็นเจ้ามือ</p>
          </div>
        </div>

        {/* Create */}
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">สร้างห้องใหม่</h2>
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setRotateBanker(v => !v)}>
            <div className={`w-10 h-5 rounded-full relative transition-colors ${rotateBanker ? 'bg-purple-600' : 'bg-white/10'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${rotateBanker ? 'left-5' : 'left-0.5'}`} />
            </div>
            <span className="text-sm text-gray-400 font-bold">หมุนเวียนเจ้ามือทุกรอบ</span>
          </label>
          <button onClick={createRoom}
            className="py-3 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 rounded-xl font-black text-base transition active:scale-95">
            🏠 สร้างห้อง
          </button>
        </div>

        {/* Join by code */}
        <div className="bg-black/60 border border-white/8 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">เข้าด้วยรหัส</h2>
          <div className="flex gap-2">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==='Enter' && joinRoom(undefined, joinCode)}
              placeholder="A1B2C3" maxLength={6}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 font-black text-center tracking-[0.3em] text-lg focus:outline-none focus:border-purple-500 uppercase" />
            <button onClick={() => joinRoom(undefined, joinCode)}
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
          {lobbyList.length === 0
            ? <p className="text-center text-gray-700 font-bold py-10 text-sm">ยังไม่มีห้อง</p>
            : lobbyList.map(r => (
              <button key={r.id} onClick={() => joinRoom(r.id)}
                className="flex items-center gap-4 p-4 bg-black/50 border border-white/6 rounded-xl hover:border-purple-500/30 hover:bg-purple-900/10 transition text-left w-full">
                <span className="text-2xl">🎴</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm">ห้อง #{r.code}</p>
                  <p className="text-gray-600 text-xs">โดย {r.hostName}</p>
                </div>
                <div className="flex gap-1">
                  {Array(r.count).fill(0).map((_,i) => <div key={i} className="w-2 h-2 rounded-full bg-purple-500" />)}
                  {Array(MAX_PLAYERS-r.count).fill(0).map((_,i) => <div key={i} className="w-2 h-2 rounded-full bg-white/10" />)}
                </div>
                <span className="text-xs text-purple-400 font-black shrink-0">{r.count}/{MAX_PLAYERS}</span>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // ROOM SCREEN
  // ══════════════════════════════════════════════════════════════════════════════
  if (!room) return null

  return (
    <div className="min-h-screen bg-[#080b12] text-white flex flex-col"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>

      <style>{`
        @keyframes cardDeal {
          from { opacity:0; transform:translateY(-50px) rotate(-12deg) scale(0.8); }
          to   { opacity:1; transform:translateY(0)     rotate(0deg)   scale(1);   }
        }
        .card-deal { animation: cardDeal .35s cubic-bezier(.22,1,.36,1) both; }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(234,179,8,.4); }
          50%     { box-shadow: 0 0 0 8px rgba(234,179,8,0); }
        }
        .glow-pulse { animation: glowPulse 1.6s ease infinite; }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        .fade-in { animation: fadeIn .4s ease forwards; }
        @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .slide-up { animation: slideUp .5s ease forwards; }
        .scr::-webkit-scrollbar { width:3px; }
        .scr::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:99px; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-white/10 text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Kick confirm modal */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 w-72 shadow-2xl">
            <span className="text-3xl">🚫</span>
            <p className="font-black text-white text-center">
              เตะ <span className="text-red-400">{room.players.find(p=>p.id===kickTarget)?.username}</span> ออกจากห้อง?
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setKickTarget(null)}
                className="flex-1 py-2.5 bg-white/5 rounded-xl font-black text-sm hover:bg-white/10 transition">
                ยกเลิก
              </button>
              <button onClick={() => kickPlayer(kickTarget)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-black text-sm transition text-white">
                เตะออก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/50 backdrop-blur-sm shrink-0">
        <button onClick={leaveRoom}
          className="text-xs font-bold text-gray-500 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg transition">
          ← ออก
        </button>
        <div className="flex-1 flex items-center gap-2 justify-center flex-wrap">
          <span className="font-black text-base italic text-white">Stellar Poker</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500 font-bold tracking-widest">#{room.code}</span>
          <span className="text-gray-700 text-xs">·</span>
          <span className="text-xs text-gray-500 font-bold">รอบ {room.roundNumber}</span>
          <PhaseBadge phase={room.phase} />
        </div>
        <div className="text-xs text-gray-600 font-bold shrink-0">{room.players.length}/{MAX_PLAYERS}</div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ GAME BOARD ════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col overflow-y-auto scr">

          {/* Banker zone */}
          <div className={`mx-4 mt-4 rounded-2xl border p-4 flex flex-col items-center gap-3 transition-all duration-300
            ${isBankerTurn ? 'border-yellow-500/50 bg-yellow-950/20 glow-pulse' : 'border-white/8 bg-black/40'}`}>

            <div className="flex items-center gap-2.5">
              <Avatar url={banker?.avatar_url ?? null} name={banker?.username ?? '?'} size={36} online={banker?.isOnline} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-white text-sm">{banker?.username ?? '—'}</span>
                  {isBanker && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">คุณ</span>}
                  <span className="text-base">🏦</span>
                </div>
                <p className="text-xs text-gray-600 font-bold">${banker?.balance?.toLocaleString()}</p>
              </div>
              {/* Banker net result */}
              {room.phase === 'RESULT' && resultVisible && banker && banker.netChange !== 0 && (
                <span className={`ml-2 text-sm font-black slide-up ${banker.netChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {banker.netChange > 0 ? '+' : ''}${banker.netChange}
                </span>
              )}
            </div>

            {/* Banker cards */}
            <div className="flex gap-2">
              {room.bankerCards.length === 0
                ? <div className="w-[64px] h-[90px] rounded-xl border border-white/6 bg-white/3" />
                : room.bankerCards.map((c,i) => <CardLg key={i} card={c} hidden={!showBankerCards} />)
              }
            </div>

            {room.bankerCards.length > 0 && showBankerCards && (
              <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-black px-3 py-0.5 rounded-full">
                {calcScore(room.bankerCards)} แต้ม
              </span>
            )}

            {isBankerTurn && (
              <div className="flex gap-3 w-full max-w-[260px]">
                <button onClick={bankerHit} disabled={room.bankerCards.length >= 3}
                  className="flex-1 py-3 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl transition active:scale-95 disabled:opacity-30 text-sm">
                  🃏 จั่วไพ่
                </button>
                <button onClick={bankerStand}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-xl transition active:scale-95 text-sm">
                  ✋ พอแล้ว
                </button>
              </div>
            )}
            {room.phase === 'BANKER_TURN' && !isBanker && (
              <p className="text-xs text-gray-600 animate-pulse font-bold">รอเจ้ามือตัดสิน...</p>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 my-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-gray-700 font-bold">ผู้เล่น ({nonBankers.length})</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Players grid */}
          <div className="px-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {nonBankers.map(p => {
              const isMe      = p.id === profile?.id
              const showCards = isMe || room.phase === 'BANKER_TURN' || room.phase === 'RESULT'
              const showResult = room.phase === 'RESULT' && resultVisible && p.result !== null
              return (
                <div key={p.id} className={`relative rounded-xl border p-3 flex flex-col gap-2 transition-all duration-200
                  ${isMe && isMyTurn     ? 'border-yellow-500/50 bg-yellow-950/20 glow-pulse' : ''}
                  ${isMe && !isMyTurn    ? 'border-yellow-500/20 bg-black/50' : ''}
                  ${!isMe               ? 'border-white/8 bg-black/40' : ''}
                  ${showResult && p.result === 'WIN'  ? 'border-green-500/30' : ''}
                  ${showResult && p.result === 'LOSE' ? 'border-red-500/20 opacity-70' : ''}
                `}>

                  {/* Result overlay (delayed) */}
                  {showResult && (
                    <ResultOverlay
                      result={p.result}
                      netChange={p.netChange}
                      label={p.resultDetail}
                    />
                  )}

                  {/* Player header */}
                  <div className="flex items-center gap-2">
                    <Avatar url={p.avatar_url} name={p.username} size={28} online={p.isOnline} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                        {p.username}{isMe ? ' (คุณ)' : ''}
                      </p>
                      <p className="text-[10px] text-gray-600">${p.balance.toLocaleString()}</p>
                    </div>
                    {/* Bet amount */}
                    {p.bet > 0 && !showResult && (
                      <span className="text-[10px] text-yellow-400 font-black shrink-0">${p.bet}</span>
                    )}
                    {/* Host kick button */}
                    {isHost && !isMe && room.phase === 'LOBBY' && (
                      <button onClick={() => setKickTarget(p.id)}
                        className="text-[10px] text-gray-700 hover:text-red-400 transition font-black shrink-0 ml-1"
                        title="เตะออก">
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex gap-1.5 justify-center">
                    {p.cards.length === 0
                      ? <div className="w-full h-[68px] rounded-lg border border-white/5 bg-black/20" />
                      : p.cards.map((c,i) => <CardSm key={i} card={c} hidden={!showCards} />)
                    }
                  </div>

                  {/* Score / action status (only when no result overlay) */}
                  {!showResult && (
                    <div className="flex items-center justify-center gap-1.5 min-h-[18px]">
                      {p.cards.length > 0 && showCards && p.action !== 'STAND' && p.action !== 'HIT' && (
                        <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {calcScore(p.cards)} แต้ม
                        </span>
                      )}
                      {p.action === 'STAND'     && <span className="text-[10px] text-blue-400 font-black">✋ หยุด</span>}
                      {p.action === 'HIT'       && <span className="text-[10px] text-purple-400 font-black">🃏 จั่วแล้ว · {calcScore(p.cards)} แต้ม</span>}
                      {p.action === 'BET_PLACED' && room.phase==='BETTING' && <span className="text-[10px] text-green-400 font-black">✅ เดิมพัน ${p.bet}</span>}
                      {p.action === 'IDLE'       && room.phase==='BETTING' && <span className="text-[10px] text-gray-600 font-bold animate-pulse">รอเดิมพัน...</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Control panel ─────────────────────────────────────────────── */}
          <div className="m-4 bg-black/70 border border-white/8 rounded-2xl p-4">

            {/* LOBBY */}
            {room.phase === 'LOBBY' && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-bold mb-1">รหัสห้อง</p>
                  <p className="text-yellow-400 font-black text-3xl tracking-[0.3em]">{room.code}</p>
                </div>
                {room.rotateBanker && (
                  <p className="text-xs text-purple-400 font-bold">🔄 หมุนเวียนเจ้ามือ · ตอนนี้: {banker?.username}</p>
                )}
                {isHost
                  ? <button onClick={startRound} disabled={room.players.length < 2}
                      className="w-full max-w-xs py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl text-lg transition active:scale-95 disabled:opacity-30">
                      {room.players.length < 2 ? `รอผู้เล่น (${room.players.length}/2)` : '🎴 เริ่มรอบ!'}
                    </button>
                  : <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้องเริ่มเกม...</p>
                }
              </div>
            )}

            {/* BETTING — ผู้เล่น ยังไม่เดิมพัน */}
            {room.phase === 'BETTING' && !isBanker && me?.action !== 'BET_PLACED' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/8">
                  <span className="text-gray-500 text-sm font-bold">เดิมพัน</span>
                  <span className="text-yellow-400 font-black text-2xl">${betInput}</span>
                </div>
                <div className="flex gap-2">
                  {[10,50,100,500].map(v => (
                    <button key={v} onClick={() => setBetInput(b => b+v)}
                      className="flex-1 py-2 bg-white/5 rounded-lg font-black text-sm hover:bg-yellow-500 hover:text-black transition">
                      +{v}
                    </button>
                  ))}
                  <button onClick={() => setBetInput(MIN_BET)} className="px-3 py-2 bg-red-900/30 text-red-400 rounded-lg font-black text-sm">↺</button>
                </div>
                <button onClick={placeBet}
                  className="py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-base transition active:scale-95">
                  ✅ ยืนยัน ${betInput}
                </button>
              </div>
            )}

            {/* BETTING — เดิมพันแล้ว รอคนอื่น */}
            {room.phase === 'BETTING' && !isBanker && me?.action === 'BET_PLACED' && (
              <p className="text-center text-gray-500 font-black animate-pulse text-sm py-2">
                รอผู้เล่นอื่น... ({nonBankers.filter(p=>p.action==='BET_PLACED').length}/{nonBankers.length})
              </p>
            )}

            {/* BETTING — เจ้ามือ */}
            {room.phase === 'BETTING' && isBanker && (
              <div className="flex flex-col items-center gap-3 py-1">
                <p className="text-yellow-500 font-black">คุณคือเจ้ามือ 🏦</p>
                <p className="text-gray-600 text-sm font-bold animate-pulse">
                  รอผู้เล่นวางเดิมพัน ({nonBankers.filter(p=>p.action==='BET_PLACED').length}/{nonBankers.length})
                </p>
                {isHost && allBet && (
                  <button onClick={() => dealCards(room.players)}
                    className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black rounded-xl transition text-sm">
                    🃏 แจกไพ่เลย!
                  </button>
                )}
              </div>
            )}

            {/* PLAYER_TURNS — ตาฉัน */}
            {isMyTurn && (
              <div className="flex flex-col gap-3">
                <p className="text-center text-xs text-yellow-400 font-black uppercase tracking-wider animate-pulse">⭐ ตาของคุณ</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={playerHit} disabled={(me?.cards.length ?? 0) >= 3}
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

            {/* PLAYER_TURNS — รอ */}
            {room.phase === 'PLAYER_TURNS' && !isMyTurn && (
              <p className="text-center text-gray-600 font-black animate-pulse text-sm py-2">
                {isBanker       ? 'รอผู้เล่นทุกคนตัดสิน...' :
                 me?.action === 'STAND' ? '✋ คุณหยุดแล้ว รอคนอื่น...' :
                 me?.action === 'HIT'   ? '🃏 จั่วแล้ว รอคนอื่น...' : 'รอผู้เล่นอื่น...'}
              </p>
            )}

            {/* BANKER_TURN — รอ (ไม่ใช่เจ้ามือ) */}
            {room.phase === 'BANKER_TURN' && !isBanker && (
              <p className="text-center text-gray-600 font-black animate-pulse text-sm py-2">
                รอเจ้ามือ {banker?.username} ตัดสิน...
              </p>
            )}

            {/* RESULT — รอ delay */}
            {room.phase === 'RESULT' && !resultVisible && (
              <p className="text-center text-gray-600 font-bold animate-pulse text-sm py-2">กำลังนับแต้ม...</p>
            )}

            {/* RESULT — แสดงผล */}
            {room.phase === 'RESULT' && resultVisible && (
              <div className="flex flex-col items-center gap-4 slide-up">

                {/* ผลของตัวเอง */}
                {me && me.id !== room.bankerId && me.result && (() => {
                  const sign = me.netChange >= 0 ? '+' : ''
                  return (
                    <p className={`text-xl md:text-2xl font-black ${me.result==='WIN' ? 'text-green-400' : me.result==='LOSE' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {me.result==='WIN'  ? `🏆 ชนะ! +$${me.netChange}` :
                       me.result==='LOSE' ? `💀 แพ้ -$${Math.abs(me.netChange)}` : '🤝 เสมอ คืนทุน'}
                      {me.resultDetail !== 'ปกติ' && me.resultDetail !== 'เสมอ' && (
                        <span className="text-sm ml-1 opacity-70"> · {me.resultDetail}</span>
                      )}
                    </p>
                  )
                })()}

                {/* ผลของเจ้ามือ */}
                {isBanker && banker && (
                  <p className={`text-xl font-black ${banker.netChange>=0 ? 'text-green-400' : 'text-red-400'}`}>
                    🏦 เจ้ามือ {banker.netChange>=0 ? `+$${banker.netChange}` : `-$${Math.abs(banker.netChange)}`}
                  </p>
                )}

                {/* Summary ผู้เล่นทุกคน */}
                <div className="w-full grid grid-cols-3 gap-1.5">
                  {nonBankers.map(p => (
                    <div key={p.id} className={`rounded-lg p-2 text-center text-[11px] font-black border
                      ${p.result==='WIN'  ? 'bg-green-900/20 border-green-500/25 text-green-400' :
                        p.result==='LOSE' ? 'bg-red-900/20 border-red-500/25 text-red-400 opacity-70' :
                        'bg-white/5 border-white/8 text-yellow-400'}`}>
                      <div className="flex justify-center mb-1">
                        <Avatar url={p.avatar_url} name={p.username} size={20} />
                      </div>
                      <p className="truncate">{p.username}</p>
                      <p>{p.netChange>0 ? `+$${p.netChange}` : p.netChange<0 ? `-$${Math.abs(p.netChange)}` : '±0'}</p>
                    </div>
                  ))}
                </div>

                {isHost
                  ? <button onClick={nextRound}
                      className="px-8 py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-xl text-base transition active:scale-95">
                      🔄 รอบถัดไป {room.rotateBanker ? `→ ${nextBankerName}` : ''}
                    </button>
                  : <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้อง...</p>
                }
              </div>
            )}
          </div>
        </div>{/* end game board */}

        {/* ═══ SIDEBAR ════════════════════════════════════════════════════ */}
        <div className="hidden md:flex w-60 border-l border-white/5 flex-col bg-black/30 shrink-0">

          {/* Players list */}
          <div className="p-4 border-b border-white/5">
            <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">ผู้เล่น</p>
            <div className="flex flex-col gap-2.5">
              {room.players.map(p => (
                <div key={p.id} className="flex items-center gap-2 group">
                  <Avatar url={p.avatar_url} name={p.username} size={28} online={p.isOnline} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${p.id===profile?.id ? 'text-yellow-400' : 'text-white'}`}>
                      {p.username}
                      {p.id===room.bankerId && ' 🏦'}
                      {p.id===room.hostId && p.id!==room.bankerId && ' 👑'}
                    </p>
                    <p className="text-[10px] text-gray-700">${p.balance.toLocaleString()}</p>
                  </div>
                  {/* Host controls */}
                  {isHost && p.id !== profile?.id && room.phase === 'LOBBY' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => transferHost(p.id)} title="โอนหัวหน้า"
                        className="text-[10px] text-gray-600 hover:text-yellow-400 font-black transition">
                        👑
                      </button>
                      <button onClick={() => setKickTarget(p.id)} title="เตะออก"
                        className="text-[10px] text-gray-600 hover:text-red-400 font-black transition">
                        ✕
                      </button>
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
              {chatLog.length === 0
                ? <p className="text-center text-gray-800 text-xs mt-4">ยังไม่มีข้อความ</p>
                : chatLog.map((c,i) => (
                  <p key={i} className="text-xs leading-snug">
                    <span className={`font-black ${c.uid===profile?.id ? 'text-yellow-400' : 'text-purple-400'}`}>{c.name}: </span>
                    <span className="text-gray-400">{c.msg}</span>
                  </p>
                ))
              }
              <div ref={chatBottomRef} />
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key==='Enter' && sendChat()}
                placeholder="ข้อความ..." maxLength={80}
                className="flex-1 bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-purple-500" />
              <button onClick={sendChat}
                className="px-2.5 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg text-xs font-black transition">
                ↵
              </button>
            </div>
          </div>

          {/* Rules */}
          <div className="p-4 border-t border-white/5">
            <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-2">กติกา</p>
            <div className="space-y-1 text-[11px] text-gray-600 font-bold">
              <p><span className="text-yellow-600">ป๊อก 8-9</span> — ชนะทันที</p>
              <p><span className="text-yellow-600">2 เด้ง</span> — ดอก/เลขเดียวกัน ×2</p>
              <p><span className="text-yellow-600">3 เด้ง</span> — ดอกเดียวกัน 3 ใบ ×3</p>
              <p><span className="text-yellow-600">เซียน</span> — J Q K ×3</p>
              <p><span className="text-yellow-600">ตอง</span> — เลขเดียวกัน 3 ใบ ×5</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
