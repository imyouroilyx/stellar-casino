// src/app/games/kaeng/kaengLib.ts
// ─── Shared pure logic for ไพ่แคง ─────────────────────────────────────────────

export const SUITS  = ['♠','♥','♦','♣'] as const
export const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'] as const

export type Card = { suit: string; value: string; score: number }

export const makeCard = (): Card => {
  const suit  = SUITS[Math.floor(Math.random() * SUITS.length)]
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]
  const score = value === 'A' ? 1 : ['10','J','Q','K'].includes(value) ? 0 : parseInt(value)
  return { suit, value, score }
}

export const calcScore = (cards: Card[]) =>
  cards.reduce((s, c) => s + c.score, 0) % 10

// แคง = ไพ่ 2 ใบ หน้าเดียวกัน (เช่น K-K, 7-7) → ×2
// ดอกเดียว = ไพ่ 2 ใบ ดอกเดียวกัน → ×2
export function getHandBonus(cards: Card[]): { mult: number; label: string } {
  if (cards.length < 2) return { mult: 1, label: '' }
  if (cards[0].value === cards[1].value) return { mult: 2, label: 'แคง' }
  if (cards[0].suit  === cards[1].suit)  return { mult: 2, label: 'ดอกเดียว' }
  return { mult: 1, label: '' }
}

// ก้าว = 9 แต้ม 2 ใบ
export const isKaao = (cards: Card[]) => cards.length === 2 && calcScore(cards) === 9
// แปด = 8 แต้ม 2 ใบ
export const isPaet = (cards: Card[]) => cards.length === 2 && calcScore(cards) === 8

export type GameResult = 'WIN' | 'LOSE' | 'DRAW'

export function resolveVsOpponent(
  myCards: Card[], theirCards: Card[]
): { result: GameResult; mult: number; label: string } {
  const ms = calcScore(myCards), ts = calcScore(theirCards)
  const { mult, label } = getHandBonus(myCards)
  if (ms > ts) return { result: 'WIN',  mult, label }
  if (ms < ts) return { result: 'LOSE', mult: getHandBonus(theirCards).mult, label: getHandBonus(theirCards).label }
  return       { result: 'DRAW', mult: 1, label: 'เสมอ' }
}

export const isRed = (suit: string) => suit === '♥' || suit === '♦'

// AI จั่วถ้าแต้ม ≤ 5
export const aiShouldDraw = (cards: Card[]) => calcScore(cards) <= 5