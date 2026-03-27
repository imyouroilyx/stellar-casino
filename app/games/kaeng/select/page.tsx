// src/app/games/kaeng/select/page.tsx
'use client'
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function KaengSelect() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#080b12] text-white flex items-center justify-center"
      style={{ backgroundImage:"url('https://iili.io/qZ3dyUg.png')", backgroundSize:'cover', backgroundAttachment:'fixed' }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .float { animation: float 3s ease-in-out infinite }
        .shimmer {
          background: linear-gradient(90deg,#fbbf24,#fef08a,#fbbf24,#f59e0b);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
      `}</style>
      <div className="flex flex-col items-center gap-8 p-6 max-w-md w-full">
        <div className="text-center float">
          <div className="text-6xl mb-2">🃏</div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter shimmer drop-shadow">ไพ่แคง</h1>
          <p className="text-gray-500 text-xs font-bold mt-2 uppercase tracking-widest">เลือกโหมดการเล่น</p>
        </div>
        <div className="flex flex-col gap-4 w-full">
          <Link href="/games/kaeng"
            className="group p-5 rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/20 to-black/60 hover:border-yellow-400/50 transition-all">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🤖</span>
              <div className="flex-1">
                <p className="text-xl font-black text-yellow-400 uppercase">Single Player</p>
                <p className="text-gray-500 text-sm font-bold">เล่นกับ AI 3 คน — เต็มรูปแบบ</p>
              </div>
              <span className="text-yellow-500/50 text-2xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
          <Link href="/games/kaeng/multiplayer"
            className="group p-5 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-black/60 hover:border-purple-400/50 transition-all">
            <div className="flex items-center gap-4">
              <span className="text-4xl">👥</span>
              <div className="flex-1">
                <p className="text-xl font-black text-purple-400 uppercase">Multiplayer</p>
                <p className="text-gray-500 text-sm font-bold">2–4 คน Realtime — ไหล, แคง, น็อค</p>
              </div>
              <span className="text-purple-500/50 text-2xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/20">Realtime</span>
              <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-bold border border-green-500/20">2–4 คน</span>
            </div>
          </Link>
        </div>
        <button onClick={() => router.back()} className="text-gray-600 hover:text-white text-xs font-bold transition">← กลับ</button>
      </div>
    </div>
  )
}
