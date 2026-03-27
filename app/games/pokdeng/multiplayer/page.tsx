'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import type { RealtimeChannel } from '@supabase/supabase-js'
 
// ─── Constants & Types ────────────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'] as const
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const MAX_PLAYERS = 6
const MIN_BET = 10
 
type Card = { suit: string; value: string; score: number }
type PlayerAction = 'IDLE' | 'BET_PLACED' | 'WAITING_CARDS' | 'DECIDING' | 'STAND' | 'HIT' | 'DONE'
type PlayerResult = 'WIN' | 'LOSE' | 'DRAW' | null
type RoomPhase = 'LOBBY' | 'BETTING' | 'DEALING' | 'PLAYER_TURNS' | 'BANKER_TURN' | 'RESULT'
 
interface PlayerState {
  id: string
  username: string
  avatar_url?: string
  balance: number
  cards: Card[]
  bet: number
  action: PlayerAction
  result: PlayerResult
  resultDetail: string
  isOnline: boolean
}
 
interface RoomState {
  id: string
  code: string
  hostId: string
  bankerId: string
  phase: RoomPhase
  players: PlayerState[]
  bankerCards: Card[]
  bankerAction: 'DECIDING' | 'STAND' | 'HIT' | 'DONE' | 'IDLE'
  roundNumber: number
  rotateBanker: boolean
}
 
// ─── Pure helpers ─────────────────────────────────────────────────────────────
function makeCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]
  const score = value === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(value) ? 0 : parseInt(value)
  return { suit, value, score }
}
 
function calcScore(cards: Card[]): number {
  return cards.reduce((s, c) => s + c.score, 0) % 10
}
 
function getHandInfo(cards: Card[]): { mult: number; label: string } {
  if (cards.length === 2) {
    if (cards[0].suit === cards[1].suit || cards[0].value === cards[1].value)
      return { mult: 2, label: '2 เด้ง' }
  } else if (cards.length === 3) {
    const vals = cards.map(c => c.value).sort()
    if (new Set(vals).size === 1) return { mult: 5, label: 'ตอง' }
    if (new Set(cards.map(c => c.suit)).size === 1) return { mult: 3, label: '3 เด้ง' }
    if (vals.every(v => ['J', 'Q', 'K'].includes(v))) return { mult: 3, label: 'เซียน' }
  }
  return { mult: 1, label: 'ปกติ' }
}
 
function isPok(cards: Card[]): boolean {
  return cards.length === 2 && calcScore(cards) >= 8
}
 
function genCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
 
function resolveResult(playerCards: Card[], bankerCards: Card[]): { result: PlayerResult; detail: string } {
  const ps = calcScore(playerCards), bs = calcScore(bankerCards)
  const { label } = getHandInfo(playerCards)
  if (ps > bs) return { result: 'WIN', detail: label }
  if (ps < bs) return { result: 'LOSE', detail: label }
  return { result: 'DRAW', detail: 'เสมอ' }
}
 
// ─── Card Component ───────────────────────────────────────────────────────────
function CardUI({ card, hidden = false, small = false }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const base = small
    ? 'w-10 h-14 text-sm rounded-lg'
    : 'w-20 md:w-24 h-28 md:h-36 text-2xl md:text-4xl rounded-xl'
  if (!card || hidden) {
    return (
      <div className={`${base} border-2 border-purple-500/40 bg-purple-900/30 flex items-center justify-center font-bold text-purple-400 card-anim`}>
        ★
      </div>
    )
  }
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`${base} bg-white text-black flex items-center justify-center font-black border-2 border-yellow-400/60 shadow-[0_0_20px_rgba(234,179,8,0.15)] card-anim`}>
      <span className={isRed ? 'text-red-500' : ''}>{card.value}{card.suit}</span>
    </div>
  )
}
 
function ScoreBadge({ score, highlight }: { score: number; highlight?: boolean }) {
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${highlight ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/40' : 'bg-white/10 text-gray-400'}`}>
      {score} แต้ม
    </span>
  )
}
 
// ─── Main Component ───────────────────────────────────────────────────────────
export default function PokDengMultiplayer() {
  const router = useRouter()
  const { profile, syncUser } = useUser()
 
  const [screen, setScreen] = useState<'LOBBY_LIST' | 'ROOM'>('LOBBY_LIST')
  const [lobbyRooms, setLobbyRooms] = useState<{ id: string; code: string; playerCount: number; hostName: string }[]>([])
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [betInput, setBetInput] = useState(MIN_BET)
  const [rotateBanker, setRotateBanker] = useState(true)
  const [toast, setToast] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState<{ uid: string; name: string; msg: string; ts: number }[]>([])
  // ✅ แยก loading state สำหรับการวางเดิมพัน ป้องกันกดซ้ำ
  const [isBetting, setIsBetting] = useState(false)
 
  const [room, setRoom] = useState<RoomState | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const roomRef = useRef<RoomState | null>(null)
 
  const snd = useRef<{ flip?: HTMLAudioElement; win?: HTMLAudioElement; lose?: HTMLAudioElement; shuffle?: HTMLAudioElement }>({})
 
  useEffect(() => {
    snd.current.flip = new Audio('/sounds/Card-flip.wav')
    snd.current.win = new Audio('/sounds/Win.wav')
    snd.current.lose = new Audio('/sounds/Lose.wav')
    snd.current.shuffle = new Audio('/sounds/Card-shuffle.wav')
    fetchLobby()
  }, [])
 
  const play = (key: keyof typeof snd.current) => {
    const a = snd.current[key]; if (a) { a.currentTime = 0; a.play().catch(() => {}) }
  }
 
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
 
  useEffect(() => { roomRef.current = room }, [room])
 
  // ─── Fetch Lobby ───────────────────────────────────────────────────────────
  const fetchLobby = async () => {
    const { data } = await supabase
      .from('pokdeng_rooms')
      .select('id, code, players, host_id, profiles!host_id(username)')
      .eq('phase', 'LOBBY')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setLobbyRooms(data.map((r: any) => ({
        id: r.id, code: r.code,
        playerCount: r.players?.length ?? 0,
        hostName: r.profiles?.username ?? 'ไม่ทราบชื่อ',
      })))
    }
  }
 
  // ─── Subscribe: Postgres Changes + Broadcast + Presence ───────────────────
  const subscribeRoom = useCallback((roomId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
 
    const ch = supabase.channel(`pokdeng:${roomId}`, {
      config: { presence: { key: profile?.id ?? 'anon' } },
    })
 
    ch.on('postgres_changes', {
      event: '*', schema: 'public', table: 'pokdeng_rooms', filter: `id=eq.${roomId}`,
    }, ({ new: updated }) => {
      const r = updated as any
      if (!r?.id) return
      const parsed: RoomState = {
        id: r.id, code: r.code, hostId: r.host_id, bankerId: r.banker_id,
        phase: r.phase, players: r.players ?? [], bankerCards: r.banker_cards ?? [],
        bankerAction: r.banker_action ?? 'IDLE', roundNumber: r.round_number ?? 1,
        rotateBanker: r.rotate_banker ?? true,
      }
      setRoom(parsed)
      if (r.phase === 'RESULT' && profile) {
        const me = parsed.players.find(p => p.id === profile.id)
        if (me?.result === 'WIN') play('win')
        else if (me?.result === 'LOSE') play('lose')
      }
    })
 
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.uid !== profile?.id) {
        setChatLog(prev => [...prev.slice(-99), payload])
      }
    })
 
    ch.on('presence', { event: 'sync' }, () => {
      const onlineIds = new Set(Object.keys(ch.presenceState()))
      setRoom(prev => prev ? {
        ...prev,
        players: prev.players.map(p => ({ ...p, isOnline: onlineIds.has(p.id) })),
      } : prev)
    })
 
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ userId: profile?.id, at: Date.now() })
    })
 
    channelRef.current = ch
  }, [profile])
 
  // ─── DB helper ────────────────────────────────────────────────────────────
  const updateRoom = async (patch: Record<string, unknown>) => {
    if (!roomRef.current) return
    const { error } = await supabase.from('pokdeng_rooms').update(patch).eq('id', roomRef.current.id)
    if (error) {
      console.error("Update Room Error:", error)
      showToast("❌ เกิดข้อผิดพลาด: " + error.message)
    }
  }
 
  // ─── Create Room ──────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!profile) return showToast('กรุณาล็อกอินก่อน')
    const me: PlayerState = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น',
      avatar_url: profile.avatar_url,
      balance: profile.balance, cards: [], bet: 0,
      action: 'IDLE', result: null, resultDetail: '', isOnline: true,
    }
    const { data, error } = await supabase.from('pokdeng_rooms').insert([{
      code: genCode(), host_id: profile.id, banker_id: profile.id,
      phase: 'LOBBY', players: [me], banker_cards: [], banker_action: 'IDLE',
      round_number: 1, rotate_banker: rotateBanker,
    }]).select().single()
    if (error || !data) return showToast('สร้างห้องไม่สำเร็จ')
 
    const parsed: RoomState = {
      id: data.id, code: data.code, hostId: data.host_id, bankerId: data.banker_id,
      phase: data.phase, players: data.players, bankerCards: data.banker_cards,
      bankerAction: data.banker_action, roundNumber: data.round_number, rotateBanker: data.rotate_banker,
    }
    setRoom(parsed); subscribeRoom(data.id); setScreen('ROOM')
  }
 
  // ─── Join Room ─────────────────────────────────────────────────────────────
  const joinRoom = async (roomId?: string, code?: string) => {
    if (!profile) return showToast('กรุณาล็อกอินก่อน')
    const q = supabase.from('pokdeng_rooms').select('*')
    const { data, error } = roomId
      ? await q.eq('id', roomId).single()
      : await q.eq('code', (code || joinCodeInput).toUpperCase()).single()
 
    if (error || !data) return showToast('ไม่พบห้อง')
    if (data.phase !== 'LOBBY' && !(data.players as PlayerState[]).find(p => p.id === profile.id))
      return showToast('เกมนี้เริ่มไปแล้ว')
 
    const existing = (data.players as PlayerState[]).find(p => p.id === profile.id)
    if (existing) {
      const parsed: RoomState = {
        id: data.id, code: data.code, hostId: data.host_id, bankerId: data.banker_id,
        phase: data.phase, players: data.players, bankerCards: data.banker_cards,
        bankerAction: data.banker_action, roundNumber: data.round_number, rotateBanker: data.rotate_banker,
      }
      setRoom(parsed); subscribeRoom(data.id); setScreen('ROOM'); return
    }
    if ((data.players as PlayerState[]).length >= MAX_PLAYERS) return showToast('ห้องเต็มแล้ว!')
 
    const me: PlayerState = {
      id: profile.id, username: profile.username ?? 'ผู้เล่น',
      avatar_url: profile.avatar_url,
      balance: profile.balance, cards: [], bet: 0,
      action: 'IDLE', result: null, resultDetail: '', isOnline: true,
    }
    const updated = [...data.players, me]
    await supabase.from('pokdeng_rooms').update({ players: updated }).eq('id', data.id)
    const parsed: RoomState = {
      id: data.id, code: data.code, hostId: data.host_id, bankerId: data.banker_id,
      phase: data.phase, players: updated, bankerCards: data.banker_cards,
      bankerAction: data.banker_action, roundNumber: data.round_number, rotateBanker: data.rotate_banker,
    }
    setRoom(parsed); subscribeRoom(data.id); setScreen('ROOM')
  }
 
  // ─── Leave Room ────────────────────────────────────────────────────────────
  const leaveRoom = async () => {
    if (!room || !profile) return
    const remaining = room.players.filter(p => p.id !== profile.id)
    if (remaining.length === 0) {
      await supabase.from('pokdeng_rooms').delete().eq('id', room.id)
    } else {
      const newBankerId = room.bankerId === profile.id ? remaining[0].id : room.bankerId
      const newHostId = room.hostId === profile.id ? remaining[0].id : room.hostId
      await updateRoom({ players: remaining, banker_id: newBankerId, host_id: newHostId })
    }
    channelRef.current && supabase.removeChannel(channelRef.current)
    setRoom(null); setScreen('LOBBY_LIST'); fetchLobby()
  }
 
  // ─── Start Round (Host) ────────────────────────────────────────────────────
  const startRound = async () => {
    if (!room || !profile) return
    if (room.hostId !== profile.id) return showToast('เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้')
    if (room.players.length < 2) return showToast('ต้องมีผู้เล่นอย่างน้อย 2 คน')
 
    play('shuffle')
    const reset = room.players.map(p => ({
      ...p, cards: [], bet: 0, action: 'IDLE' as PlayerAction, result: null, resultDetail: '',
    }))
 
    await updateRoom({ phase: 'BETTING', players: reset, banker_cards: [], banker_action: 'IDLE' })
  }
 
  // ─── Place Bet ─────────────────────────────────────────────────────────────
  // ✅ แก้ไขหลัก: ดึงข้อมูลจาก DB โดยตรงก่อน update เพื่อป้องกัน race condition
  const placeBet = async () => {
    if (!room || !profile) return
    if (isBetting) return // ป้องกันกดซ้ำ
    if (profile.id === room.bankerId) return showToast('เจ้ามือไม่ต้องวางเดิมพัน')
    if (betInput < MIN_BET) return showToast(`เดิมพันขั้นต่ำ $${MIN_BET}`)
 
    setIsBetting(true)
    try {
      // ✅ ดึงข้อมูล room และ profile ล่าสุดจาก DB ก่อนเสมอ
      const [{ data: freshRoom, error: roomErr }, { data: freshProfile, error: profErr }] = await Promise.all([
        supabase.from('pokdeng_rooms').select('*').eq('id', room.id).single(),
        supabase.from('profiles').select('balance').eq('id', profile.id).single(),
      ])
 
      if (roomErr || !freshRoom) { showToast('ไม่สามารถโหลดข้อมูลห้องได้'); return }
      if (profErr || !freshProfile) { showToast('ไม่สามารถโหลดข้อมูลผู้เล่นได้'); return }
 
      // ✅ ตรวจสอบ phase จาก DB ล่าสุด ไม่ใช่จาก state
      if (freshRoom.phase !== 'BETTING') return showToast('ไม่ได้อยู่ในช่วงวางเดิมพัน')
 
      // ✅ ตรวจสอบว่าผู้เล่นยังไม่ได้วางเดิมพัน (ป้องกัน double bet)
      const freshPlayers: PlayerState[] = freshRoom.players ?? []
      const meInRoom = freshPlayers.find(p => p.id === profile.id)
      if (!meInRoom) { showToast('คุณไม่ได้อยู่ในห้องนี้'); return }
      if (meInRoom.action === 'BET_PLACED') { showToast('คุณวางเดิมพันไปแล้ว'); return }
 
      // ✅ ตรวจสอบ balance จาก DB ล่าสุด
      const currentBalance = freshProfile.balance
      if (betInput > currentBalance) return showToast(`ยอดเงินไม่พอ (มี $${currentBalance.toLocaleString()})`)
 
      // ✅ อัปเดต players array โดยใช้ข้อมูลล่าสุดจาก DB
      const updatedPlayers = freshPlayers.map(p =>
        p.id === profile.id ? { ...p, bet: betInput, action: 'BET_PLACED' as PlayerAction } : p
      )
 
      const { error: updateErr } = await supabase
        .from('pokdeng_rooms')
        .update({ players: updatedPlayers })
        .eq('id', room.id)
 
      if (updateErr) { showToast('วางเดิมพันไม่สำเร็จ: ' + updateErr.message); return }
 
      // ✅ ตรวจสอบว่าทุกคนวางเดิมพันครบหรือยัง (ใช้ข้อมูลล่าสุด)
      const nonBankersLatest = updatedPlayers.filter(p => p.id !== freshRoom.banker_id)
      const allBetNow = nonBankersLatest.length > 0 && nonBankersLatest.every(p => p.action === 'BET_PLACED')
 
      // ✅ host เป็นคนแจกไพ่ แต่ต้องรอให้ state update จาก realtime ก่อน
      // ใช้ freshRoom.host_id เพื่อตรวจสอบ
      if (allBetNow && freshRoom.host_id === profile.id) {
        await dealAllCards(updatedPlayers, freshRoom.banker_id, room.id)
      }
    } finally {
      setIsBetting(false)
    }
  }
 
  // ─── Deal Cards ────────────────────────────────────────────────────────────
  // ✅ แก้ไข: รับ bankerId และ roomId เป็น parameter แทนการอ่านจาก roomRef เพื่อความแม่นยำ
  const dealAllCards = async (
    players: PlayerState[],
    bankerId?: string,
    roomId?: string
  ) => {
    const targetRoomId = roomId ?? roomRef.current?.id
    const targetBankerId = bankerId ?? roomRef.current?.bankerId
    if (!targetRoomId || !targetBankerId) return
 
    play('shuffle')
    const bankerCards = [makeCard(), makeCard()]
    const bPok = isPok(bankerCards)
 
    const dealt = players.map(p => {
      if (p.id === targetBankerId) return { ...p, cards: [], action: 'IDLE' as PlayerAction }
      const cards = [makeCard(), makeCard()]
      const pPok = isPok(cards)
      if (bPok || pPok) {
        const { result, detail } = resolveResult(cards, bankerCards)
        return { ...p, cards, action: 'DONE' as PlayerAction, result, resultDetail: detail }
      }
      return { ...p, cards, action: 'DECIDING' as PlayerAction }
    })
 
    const allDone = dealt.filter(p => p.id !== targetBankerId).every(p => p.action === 'DONE')
 
    const { error } = await supabase.from('pokdeng_rooms').update({
      phase: allDone ? 'RESULT' : 'PLAYER_TURNS',
      players: dealt,
      banker_cards: bankerCards,
      banker_action: bPok || allDone ? 'DONE' : 'DECIDING',
    }).eq('id', targetRoomId)
 
    if (error) { showToast('แจกไพ่ไม่สำเร็จ: ' + error.message); return }
 
    if (allDone) await finalizeByIds(dealt, bankerCards, targetBankerId, targetRoomId)
  }
 
  // ─── Player Hit ────────────────────────────────────────────────────────────
  const playerHit = async () => {
    if (!room || !profile) return
    play('flip')
    const newCard = makeCard()
 
    // ✅ ดึง room ล่าสุดก่อน update
    const { data: freshRoom } = await supabase.from('pokdeng_rooms').select('players').eq('id', room.id).single()
    if (!freshRoom) return showToast('โหลดข้อมูลไม่สำเร็จ')
 
    const freshPlayers: PlayerState[] = freshRoom.players ?? []
    const updated = freshPlayers.map(p =>
      p.id === profile.id ? { ...p, cards: [...p.cards, newCard], action: 'HIT' as PlayerAction } : p
    )
    await updateRoom({ players: updated })
    await checkAllActed(updated, room.bankerCards)
  }
 
  // ─── Player Stand ──────────────────────────────────────────────────────────
  const playerStand = async () => {
    if (!room || !profile) return
 
    // ✅ ดึง room ล่าสุดก่อน update
    const { data: freshRoom } = await supabase.from('pokdeng_rooms').select('players').eq('id', room.id).single()
    if (!freshRoom) return showToast('โหลดข้อมูลไม่สำเร็จ')
 
    const freshPlayers: PlayerState[] = freshRoom.players ?? []
    const updated = freshPlayers.map(p =>
      p.id === profile.id ? { ...p, action: 'STAND' as PlayerAction } : p
    )
    await updateRoom({ players: updated })
    await checkAllActed(updated, room.bankerCards)
  }
 
  const checkAllActed = async (players: PlayerState[], bankerCards: Card[]) => {
    if (!roomRef.current) return
    const nonBankers = players.filter(p => p.id !== roomRef.current!.bankerId)
    if (nonBankers.every(p => ['STAND', 'HIT', 'DONE'].includes(p.action))) {
      await updateRoom({ phase: 'BANKER_TURN', banker_action: 'DECIDING' })
    }
  }
 
  // ─── Banker Hit ────────────────────────────────────────────────────────────
  const bankerHit = async () => {
    if (!room || !profile || profile.id !== room.bankerId) return
    play('flip')
 
    // ✅ ดึง banker_cards ล่าสุดจาก DB
    const { data: freshRoom } = await supabase.from('pokdeng_rooms').select('banker_cards').eq('id', room.id).single()
    if (!freshRoom) return showToast('โหลดข้อมูลไม่สำเร็จ')
 
    const newBankerCards = [...(freshRoom.banker_cards ?? []), makeCard()]
    await updateRoom({ banker_cards: newBankerCards })
  }
 
  // ─── Banker Stand → Finalize ───────────────────────────────────────────────
  const bankerStand = async () => {
    if (!room || !profile || profile.id !== room.bankerId) return
    await updateRoom({ banker_action: 'STAND' })
    await finalize(room.players, room.bankerCards)
  }
 
  // ─── Finalize (ใช้ roomRef) ────────────────────────────────────────────────
  const finalize = async (players: PlayerState[], bankerCards: Card[]) => {
    if (!roomRef.current) return
    await finalizeByIds(players, bankerCards, roomRef.current.bankerId, roomRef.current.id)
  }
 
  // ✅ แก้ไข: แยก finalize ออกมาเพื่อรับ bankerId / roomId โดยตรง ไม่ต้องพึ่ง ref
  const finalizeByIds = async (
    players: PlayerState[],
    bankerCards: Card[],
    bankerId: string,
    roomId: string
  ) => {
    const resolved = players.map(p => {
      if (p.id === bankerId || p.action === 'DONE') return p
      const { result, detail } = resolveResult(p.cards, bankerCards)
      return { ...p, action: 'DONE' as PlayerAction, result, resultDetail: detail }
    })
 
    let bankerNet = 0
    for (const p of resolved) {
      if (p.id === bankerId || !p.result) continue
      const { mult } = getHandInfo(p.cards)
      if (p.result === 'WIN') bankerNet -= p.bet * mult
      else if (p.result === 'LOSE') bankerNet += p.bet * mult
    }
 
    await supabase.from('pokdeng_rooms').update({
      phase: 'RESULT', players: resolved, banker_action: 'DONE'
    }).eq('id', roomId)
 
    for (const p of resolved) {
      if (p.id === bankerId) continue
      const { mult } = getHandInfo(p.cards)
      const { data: curr } = await supabase.from('profiles').select('balance').eq('id', p.id).single()
      if (curr) {
        const payout = p.result === 'WIN' ? p.bet * (mult + 1) : p.result === 'DRAW' ? p.bet : 0
        await supabase.from('profiles').update({ balance: curr.balance - p.bet + payout }).eq('id', p.id)
        await supabase.from('game_logs').insert([{
          user_id: p.id, game_name: 'PokDeng-Multi',
          change_amount: payout - p.bet,
          result: p.result === 'WIN' ? `ชนะ +$${p.bet * mult} (${p.resultDetail})` : p.result === 'DRAW' ? 'เสมอ' : `แพ้ -$${p.bet}`,
        }])
      }
    }
    const { data: bc } = await supabase.from('profiles').select('balance').eq('id', bankerId).single()
    if (bc) {
      await supabase.from('profiles').update({ balance: bc.balance + bankerNet }).eq('id', bankerId)
      await supabase.from('game_logs').insert([{
        user_id: bankerId, game_name: 'PokDeng-Multi',
        change_amount: bankerNet,
        result: `เจ้ามือ ${bankerNet >= 0 ? '+' : ''}$${bankerNet}`,
      }])
    }
    syncUser()
  }
 
  // ─── Next Round ────────────────────────────────────────────────────────────
  const nextRound = async () => {
    if (!room || !profile || room.hostId !== profile.id) return
    let nextBankerId = room.bankerId
    if (room.rotateBanker) {
      const idx = room.players.findIndex(p => p.id === room.bankerId)
      nextBankerId = room.players[(idx + 1) % room.players.length].id
    }
    const reset = room.players.map(p => ({
      ...p, cards: [], bet: 0, action: 'IDLE' as PlayerAction, result: null, resultDetail: '',
    }))
    await updateRoom({
      phase: 'BETTING', players: reset, banker_cards: [], banker_action: 'IDLE',
      banker_id: nextBankerId, round_number: room.roundNumber + 1,
    })
  }
 
  // ─── Send Chat ─────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || !room || !profile) return
    const payload = { uid: profile.id, name: profile.username ?? 'ผู้เล่น', msg: chatInput.trim(), ts: Date.now() }
    setChatLog(prev => [...prev.slice(-99), payload])
    await channelRef.current?.send({ type: 'broadcast', event: 'chat', payload })
    setChatInput('')
  }
 
  // ─── Derived ──────────────────────────────────────────────────────────────
  const me = room?.players.find(p => p.id === profile?.id)
  const banker = room?.players.find(p => p.id === room?.bankerId)
  const isHost = room?.hostId === profile?.id
  const isBanker = room?.bankerId === profile?.id
  const nonBankers = room?.players.filter(p => p.id !== room?.bankerId) ?? []
  const allBet = nonBankers.length > 0 && nonBankers.every(p => p.action === 'BET_PLACED')
  const myTurn = room?.phase === 'PLAYER_TURNS' && me?.action === 'DECIDING' && !isBanker
  const bankerTurn = room?.phase === 'BANKER_TURN' && isBanker
  const nextBankerName = room ? room.players[(room.players.findIndex(p => p.id === room.bankerId) + 1) % room.players.length]?.username : ''
 
  // ══════════════════════════════════════════════════════════════════════════
  //  LOBBY LIST
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === 'LOBBY_LIST') {
    return (
      <div className="flex min-h-screen w-full bg-[#07090f] text-white overflow-y-auto"
        style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
        <style>{`
          @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
          .fu{animation:fadeUp .3s ease forwards}
          .scr::-webkit-scrollbar{width:3px}
          .scr::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px}
        `}</style>
 
        {toast && <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-white/10 px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl">{toast}</div>}
 
        <div className="w-full max-w-2xl mx-auto p-5 flex flex-col gap-6">
          <div className="flex items-center gap-3 pt-4">
            <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-gray-400 text-sm font-bold">← กลับ</button>
            <div>
              <h1 className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-yellow-400 uppercase tracking-tight">Multiplayer</h1>
              <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">ป๊อกเด้ง · ผู้เล่นเป็นเจ้ามือ</p>
            </div>
          </div>
 
          <div className="bg-black/60 rounded-3xl border border-white/10 p-5 flex flex-col gap-4">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">สร้างห้องใหม่</h2>
            <label className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setRotateBanker(v => !v)}>
              <div className={`w-10 h-6 rounded-full relative transition-colors ${rotateBanker ? 'bg-purple-600' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${rotateBanker ? 'left-5' : 'left-1'}`} />
              </div>
              <span className="text-sm font-bold text-gray-400">หมุนเวียนเจ้ามือทุกรอบ</span>
            </label>
            <button onClick={createRoom}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-black rounded-2xl text-lg transition active:scale-95 shadow-lg">
              🏠 สร้างห้อง
            </button>
          </div>
 
          <div className="bg-black/60 rounded-3xl border border-white/10 p-5 flex flex-col gap-3">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">เข้าด้วยรหัสห้อง</h2>
            <div className="flex gap-2">
              <input value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value.toUpperCase())} maxLength={6}
                placeholder="A1B2C3" onKeyDown={e => e.key === 'Enter' && joinRoom(undefined, joinCodeInput)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-black text-center tracking-[0.3em] text-lg focus:outline-none focus:border-purple-500 uppercase" />
              <button onClick={() => joinRoom(undefined, joinCodeInput)}
                className="px-5 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition text-sm">
                เข้าร่วม
              </button>
            </div>
          </div>
 
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest">ห้องที่เปิดอยู่ ({lobbyRooms.length})</h2>
              <button onClick={fetchLobby} className="text-xs text-gray-600 hover:text-white font-bold transition">🔄 รีเฟรช</button>
            </div>
            {lobbyRooms.length === 0
              ? <p className="text-center text-gray-700 font-bold py-8 text-sm">ยังไม่มีห้องเปิดอยู่</p>
              : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scr">
                  {lobbyRooms.map((r, i) => (
                    <div key={r.id}
                      className="fu flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-purple-500/30 cursor-pointer transition"
                      style={{ animationDelay: `${i * 0.04}s` }}
                      onClick={() => joinRoom(r.id)}>
                      <span className="text-2xl">🎴</span>
                      <div className="flex-1">
                        <p className="font-black text-white text-sm">ห้อง #{r.code}</p>
                        <p className="text-gray-600 text-xs">โดย {r.hostName}</p>
                      </div>
                      <div className="flex gap-1">
                        {Array(r.playerCount).fill(0).map((_, j) => <div key={j} className="w-2 h-2 rounded-full bg-purple-400" />)}
                        {Array(MAX_PLAYERS - r.playerCount).fill(0).map((_, j) => <div key={j} className="w-2 h-2 rounded-full bg-white/10" />)}
                      </div>
                      <span className="text-xs text-purple-400 font-black">{r.playerCount}/{MAX_PLAYERS}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    )
  }
 
  // ══════════════════════════════════════════════════════════════════════════
  //  ROOM
  // ══════════════════════════════════════════════════════════════════════════
  if (!room) return null
 
  return (
    <div className="flex min-h-screen w-full bg-[#07090f] text-white overflow-y-auto"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed' }}>
      <style>{`
        @keyframes deal{from{transform:translateY(-40vh) rotate(180deg);opacity:0}to{transform:translateY(0) rotate(0);opacity:1}}
        .card-anim{animation:deal .45s cubic-bezier(.18,.89,.32,1.28) forwards}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(234,179,8,.5)}50%{box-shadow:0 0 0 12px rgba(234,179,8,0)}}
        .my-glow{animation:glow 1.5s ease infinite}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .3s ease forwards}
        .scr::-webkit-scrollbar{width:3px}
        .scr::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px}
      `}</style>
 
      {toast && <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-black/95 border border-white/10 px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl animate-bounce">{toast}</div>}
 
      <div className="flex-1 flex flex-col xl:flex-row gap-5 p-4 md:p-6 max-w-[1500px] mx-auto w-full">
 
        {/* ═══ MAIN BOARD ══════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
 
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={leaveRoom} className="text-xs font-bold text-gray-600 hover:text-white px-3 py-2 bg-white/5 rounded-xl transition">← ออกห้อง</button>
            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 uppercase tracking-tight">Stellar Poker</h1>
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <span className="text-xs text-gray-600 font-bold">#{room.code}</span>
                <span className="text-gray-700 text-xs">·</span>
                <span className="text-xs text-gray-600 font-bold">รอบ {room.roundNumber}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  room.phase === 'LOBBY' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  room.phase === 'BETTING' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  room.phase === 'RESULT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                  {room.phase === 'LOBBY' ? '● รอผู้เล่น' :
                   room.phase === 'BETTING' ? '💰 เดิมพัน' :
                   room.phase === 'PLAYER_TURNS' ? '🃏 ผู้เล่นตัดสิน' :
                   room.phase === 'BANKER_TURN' ? '🏦 เจ้ามือตัดสิน' :
                   room.phase === 'RESULT' ? '🏆 ผลการแข่ง' : '🃏 แจกไพ่'}
                </span>
              </div>
            </div>
            <div className="text-right text-xs text-gray-600 font-bold">{room.players.length}/{MAX_PLAYERS}<br/>ผู้เล่น</div>
          </div>
 
          {/* ── Banker Zone ── */}
          <div className={`rounded-3xl border p-5 flex flex-col items-center gap-3 backdrop-blur-sm transition-all duration-300 ${
            isBanker && bankerTurn ? 'border-yellow-500/60 bg-yellow-900/10 my-glow' :
            isBanker ? 'border-yellow-500/30 bg-yellow-900/5' : 'border-white/10 bg-black/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img src={banker?.avatar_url || 'https://iili.io/qQNVmS1.png'} className="w-12 h-12 rounded-full object-cover border-2 border-yellow-500/50 shadow-lg" alt="avatar" />
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${banker?.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
              </div>
              <div className="text-left">
                <p className="font-black text-yellow-400 text-lg flex items-center gap-1">
                  🏦 {banker?.username ?? '—'}
                </p>
                <p className="text-xs text-gray-600 font-bold">
                  เจ้ามือ {isBanker && <span className="text-yellow-500">(คุณ)</span>}
                  {banker?.balance !== undefined && ` · $${banker.balance.toLocaleString()}`}
                </p>
              </div>
            </div>
 
            <div className="flex gap-2 md:gap-3 mt-2">
              {room.bankerCards.length === 0
                ? <div className="w-20 md:w-24 h-28 md:h-36 border-2 border-white/5 rounded-xl bg-black/20" />
                : room.bankerCards.map((c, i) => (
                  <CardUI key={i} card={c} hidden={room.phase !== 'BANKER_TURN' && room.phase !== 'RESULT' && !isBanker} />
                ))}
            </div>
 
            {room.bankerCards.length > 0 && (isBanker || room.phase === 'BANKER_TURN' || room.phase === 'RESULT') && (
              <ScoreBadge score={calcScore(room.bankerCards)} highlight />
            )}
 
            {bankerTurn && (
              <div className="flex gap-3 mt-1">
                <button onClick={bankerHit} disabled={room.bankerCards.length >= 3}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-base transition active:scale-95 disabled:opacity-30">
                  🃏 จั่วไพ่
                </button>
                <button onClick={bankerStand}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-2xl text-base transition active:scale-95">
                  ✋ พอแล้ว
                </button>
              </div>
            )}
            {room.phase === 'BANKER_TURN' && !isBanker && (
              <p className="text-xs text-gray-600 animate-pulse font-bold">รอเจ้ามือตัดสิน...</p>
            )}
          </div>
 
          {/* ── Players Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {nonBankers.map(p => {
              const isMe = p.id === profile?.id
              const showCards = isMe || room.phase === 'BANKER_TURN' || room.phase === 'RESULT'
              return (
                <div key={p.id} className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all duration-300 fu
                  ${isMe && myTurn ? 'border-yellow-500/60 bg-yellow-900/10 my-glow' :
                    isMe ? 'border-yellow-500/20 bg-yellow-900/5' : 'border-white/10 bg-black/40'}
                  ${p.result === 'WIN' ? 'border-green-500/40 bg-green-900/10' : ''}
                  ${p.result === 'LOSE' ? 'opacity-60' : ''}
                `}>
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <img src={p.avatar_url || 'https://iili.io/qQNVmS1.png'} className={`w-8 h-8 rounded-full object-cover border ${isMe ? 'border-yellow-500' : 'border-gray-700'}`} alt="avatar" />
                      <div className={`absolute bottom-0 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${p.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
                    </div>
 
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black truncate ${isMe ? 'text-yellow-400' : 'text-white'}`}>
                        {p.username}{isMe && ' (คุณ)'}
                      </p>
                      <p className="text-[10px] text-gray-600">${p.balance.toLocaleString()}</p>
                    </div>
                    {p.bet > 0 && (
                      <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded-md font-black border border-yellow-500/20 shrink-0">${p.bet}</span>
                    )}
                  </div>
 
                  {/* Cards */}
                  <div className="flex gap-1.5 h-14">
                    {p.cards.length === 0
                      ? <div className="flex-1 rounded-xl border border-white/5 bg-black/20 h-full" />
                      : p.cards.map((c, i) => <CardUI key={i} card={c} hidden={!showCards} small />)}
                  </div>
 
                  {/* Status */}
                  <div className="text-center text-[11px] font-black min-h-[16px]">
                    {p.result === 'WIN' && <span className="text-green-400">🏆 +${p.bet * getHandInfo(p.cards).mult} ({p.resultDetail})</span>}
                    {p.result === 'LOSE' && <span className="text-red-400">💀 -${p.bet * getHandInfo(p.cards).mult}</span>}
                    {p.result === 'DRAW' && <span className="text-yellow-400">🤝 เสมอ</span>}
                    {!p.result && p.cards.length > 0 && showCards && <ScoreBadge score={calcScore(p.cards)} />}
                    {!p.result && p.action === 'STAND' && <span className="text-blue-400">✋ หยุด</span>}
                    {!p.result && p.action === 'HIT' && <span className="text-purple-400">🃏 จั่วแล้ว</span>}
                    {!p.result && p.action === 'BET_PLACED' && room.phase === 'BETTING' && <span className="text-green-400">✅ เดิมพันแล้ว</span>}
                    {!p.result && p.action === 'IDLE' && room.phase === 'BETTING' && <span className="text-gray-600 animate-pulse">รอวางเดิมพัน</span>}
                  </div>
                </div>
              )
            })}
          </div>
 
          {/* ── Control Panel ── */}
          <div className="bg-black/85 rounded-3xl border border-white/10 p-5 shadow-2xl">
            {room.phase === 'LOBBY' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-gray-500 text-sm font-bold">รหัสห้อง</p>
                  <p className="text-yellow-400 font-black tracking-[0.35em] text-3xl">{room.code}</p>
                </div>
                {room.rotateBanker && (
                  <div className="text-xs text-purple-400 bg-purple-500/10 px-4 py-1.5 rounded-full font-bold border border-purple-500/20">
                    🔄 หมุนเวียนเจ้ามือทุกรอบ · เจ้ามือคนแรก: {banker?.username}
                  </div>
                )}
                {isHost ? (
                  <button onClick={startRound} disabled={room.players.length < 2}
                    className={`w-full py-4 font-black rounded-2xl text-xl transition active:scale-95 ${
                      room.players.length < 2
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-white hover:bg-yellow-400 text-black shadow-lg'
                    }`}>
                    {room.players.length < 2 ? `รอผู้เล่น... (${room.players.length}/2)` : '🎴 เริ่มเกม!'}
                  </button>
                ) : (
                  <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้องเริ่มเกม...</p>
                )}
              </div>
            )}
 
            {/* ✅ แสดง panel วางเดิมพัน: ไม่ใช่เจ้ามือ และยังไม่ได้วาง */}
            {room.phase === 'BETTING' && !isBanker && me?.action !== 'BET_PLACED' && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest text-center">💰 วางเดิมพัน</p>
                <div className="flex items-center justify-between px-5 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <span className="text-gray-500 font-bold text-sm">เดิมพัน</span>
                  <span className="text-3xl font-black text-yellow-400">${betInput}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[10, 50, 100, 500, 1000].map(v => (
                    <button key={v} onClick={() => setBetInput(b => b + v)}
                      className="flex-1 py-2.5 bg-white/5 rounded-xl font-black text-sm hover:bg-yellow-500 hover:text-black transition min-w-[2.5rem]">
                      +{v}
                    </button>
                  ))}
                  <button onClick={() => setBetInput(MIN_BET)} className="px-3 py-2.5 bg-red-900/30 text-red-400 rounded-xl font-black text-sm">Reset</button>
                </div>
                {/* ✅ ปุ่มวางเดิมพันแสดง loading และ disabled ระหว่างรอ */}
                <button
                  onClick={placeBet}
                  disabled={isBetting}
                  className={`w-full py-4 font-black rounded-2xl text-lg transition active:scale-95 ${
                    isBetting
                      ? 'bg-yellow-700 text-yellow-200 cursor-not-allowed opacity-70'
                      : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  }`}>
                  {isBetting ? '⏳ กำลังวางเดิมพัน...' : `✅ ยืนยัน $${betInput}`}
                </button>
              </div>
            )}
 
            {room.phase === 'BETTING' && !isBanker && me?.action === 'BET_PLACED' && (
              <div className="text-center py-5 text-gray-600 font-black animate-pulse text-sm">
                ✅ วางเดิมพันแล้ว รอผู้เล่นอื่น ({nonBankers.filter(p => p.action === 'BET_PLACED').length}/{nonBankers.length})
              </div>
            )}
 
            {room.phase === 'BETTING' && isBanker && (
              <div className="text-center flex flex-col items-center gap-3 py-2">
                <p className="text-yellow-500 font-black text-lg">คุณคือเจ้ามือ 🏦</p>
                <p className="text-gray-600 font-bold text-sm animate-pulse">
                  รอผู้เล่นวางเดิมพัน ({nonBankers.filter(p => p.action === 'BET_PLACED').length}/{nonBankers.length})
                </p>
                {isHost && allBet && (
                  <button onClick={() => dealAllCards(room.players, room.bankerId, room.id)}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-base transition active:scale-95">
                    🃏 แจกไพ่ทันที!
                  </button>
                )}
              </div>
            )}
 
            {myTurn && (
              <div className="flex flex-col gap-4">
                <p className="text-center text-xs font-black text-yellow-400 uppercase tracking-widest animate-pulse">⭐ ตาของคุณ!</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={playerHit} disabled={(me?.cards.length ?? 0) >= 3}
                    className="py-5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-xl shadow-lg transition active:scale-95 disabled:opacity-30">
                    🃏 จั่วไพ่
                  </button>
                  <button onClick={playerStand}
                    className="py-5 bg-gray-700 hover:bg-gray-600 text-white font-black rounded-2xl text-xl shadow-lg transition active:scale-95">
                    ✋ พอแล้ว
                  </button>
                </div>
              </div>
            )}
 
            {room.phase === 'PLAYER_TURNS' && !myTurn && !isBanker && (
              <div className="text-center py-5 text-gray-600 font-black animate-pulse text-sm">
                {me?.action === 'STAND' ? '✋ คุณหยุดแล้ว รอผู้เล่นอื่น...' :
                 me?.action === 'HIT' ? '🃏 จั่วแล้ว รอผู้เล่นอื่น...' : 'รอผู้เล่นอื่นตัดสิน...'}
              </div>
            )}
 
            {room.phase === 'PLAYER_TURNS' && isBanker && (
              <div className="text-center py-5 text-gray-600 font-black animate-pulse text-sm">รอผู้เล่นทุกคนตัดสิน...</div>
            )}
 
            {room.phase === 'BANKER_TURN' && !isBanker && (
              <div className="text-center py-5 text-gray-600 font-black animate-pulse text-sm">รอเจ้ามือ {banker?.username} ตัดสิน...</div>
            )}
 
            {room.phase === 'DEALING' && (
              <div className="text-center py-5 text-gray-500 font-black animate-pulse">กำลังแจกไพ่...</div>
            )}
 
            {room.phase === 'RESULT' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-full grid grid-cols-2 gap-2">
                  {nonBankers.map(p => (
                    <div key={p.id} className={`p-2.5 rounded-xl text-center text-xs font-black border
                      ${p.result === 'WIN' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                        p.result === 'LOSE' ? 'bg-red-900/20 border-red-500/30 text-red-400 opacity-70' :
                        'bg-white/5 border-white/10 text-yellow-400'}`}>
                      <p className="truncate">{p.username}</p>
                      <p>{p.result === 'WIN' ? `+$${p.bet * getHandInfo(p.cards).mult}` : p.result === 'LOSE' ? `-$${p.bet * getHandInfo(p.cards).mult}` : 'เสมอ'}</p>
                    </div>
                  ))}
                </div>
 
                {me && me.id !== room.bankerId && me.result && (
                  <div className={`text-2xl md:text-3xl font-black animate-bounce ${me.result === 'WIN' ? 'text-green-400' : me.result === 'LOSE' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {me.result === 'WIN'
                      ? `🏆 ชนะ! +$${me.bet * getHandInfo(me.cards).mult} (${getHandInfo(me.cards).label})`
                      : me.result === 'LOSE'
                      ? `💀 แพ้ -$${me.bet * getHandInfo(me.cards).mult}`
                      : '🤝 เสมอ คืนทุน'}
                  </div>
                )}
 
                {isHost ? (
                  <button onClick={nextRound}
                    className="px-8 py-3 bg-white hover:bg-yellow-400 text-black font-black rounded-2xl text-base transition active:scale-95">
                    🔄 รอบถัดไป {room.rotateBanker ? `→ เจ้ามือ: ${nextBankerName}` : ''}
                  </button>
                ) : (
                  <p className="text-gray-600 font-bold animate-pulse text-sm">รอเจ้าของห้องเริ่มรอบถัดไป...</p>
                )}
              </div>
            )}
          </div>
        </div>
 
        {/* ═══ SIDEBAR ══════════════════════════════════════════════════════ */}
        <div className="w-full xl:w-64 flex flex-col gap-4 shrink-0">
 
          <div className="bg-black/70 rounded-3xl border border-white/10 p-4 flex flex-col gap-3">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">ผู้เล่น ({room.players.length}/{MAX_PLAYERS})</h3>
            {room.players.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <img src={p.avatar_url || 'https://iili.io/qQNVmS1.png'} className="w-6 h-6 rounded-full object-cover border border-gray-700" alt="avatar" />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#07090f] ${p.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                </div>
 
                <span className={`text-xs font-black flex-1 truncate ${p.id === profile?.id ? 'text-yellow-400' : 'text-white'}`}>
                  {p.username}
                  {p.id === room.bankerId && ' 🏦'}
                  {p.id === room.hostId && p.id !== room.bankerId && ' 👑'}
                </span>
                <span className="text-[10px] text-gray-600 font-bold shrink-0">${p.balance.toLocaleString()}</span>
              </div>
            ))}
          </div>
 
          <div className="bg-black/70 rounded-3xl border border-white/10 p-4 flex flex-col gap-2 h-56 xl:h-72">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">💬 แชท</h3>
            <div className="flex-1 overflow-y-auto scr flex flex-col gap-1 min-h-0">
              {chatLog.length === 0 && <p className="text-gray-700 text-xs text-center mt-4">ยังไม่มีข้อความ</p>}
              {chatLog.map((c, i) => (
                <div key={i} className="text-xs leading-snug">
                  <span className={`font-black ${c.uid === profile?.id ? 'text-yellow-400' : 'text-purple-400'}`}>{c.name}: </span>
                  <span className="text-gray-400">{c.msg}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="พิมพ์ข้อความ..." maxLength={80}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-purple-500" />
              <button onClick={sendChat} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-black transition">ส่ง</button>
            </div>
          </div>
 
          <div className="bg-black/70 rounded-3xl border border-white/10 p-4">
            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest text-center mb-3">กติกา</h3>
            <div className="space-y-1.5 text-[11px] text-gray-500 font-bold">
              <p><span className="text-yellow-500">ป๊อก 8-9:</span> ชนะทันที</p>
              <p><span className="text-yellow-500">2 เด้ง:</span> ดอก/เลขเดียวกัน ×2</p>
              <p><span className="text-yellow-500">3 เด้ง:</span> ดอกเดียวกัน 3 ใบ ×3</p>
              <p><span className="text-yellow-500">เซียน:</span> J Q K ×3</p>
              <p><span className="text-yellow-500">ตอง:</span> เลขเดียวกัน 3 ใบ ×5</p>
              <div className="pt-2 mt-2 border-t border-white/5 space-y-1 text-gray-700">
                <p>🏦 เจ้ามือจั่ว/หยุดเองได้</p>
                <p>🔄 หมุนเวียนเจ้ามือ</p>
                <p>👑 เจ้าของห้องควบคุมเกม</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
