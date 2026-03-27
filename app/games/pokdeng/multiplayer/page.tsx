// src/app/games/pokdeng/multiplayer/page.tsx
'use client'
import React from 'react'
import { useRouter } from 'next/navigation'

export default function PokDengMultiplayer() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#080b12] text-white flex flex-col items-center justify-center"
      style={{backgroundImage:"url('https://iili.io/qZ3dyUg.png')",backgroundSize:'cover',backgroundAttachment:'fixed'}}>
      
      <div className="bg-black/60 border border-white/10 rounded-3xl p-10 flex flex-col items-center gap-6 max-w-md text-center shadow-2xl backdrop-blur-md">
        <span className="text-7xl animate-bounce">🚧</span>
        
        <div>
          <h1 className="text-3xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 tracking-tight mb-3">
            ป๊อกเด้ง Multiplayer
          </h1>
          <p className="text-lg text-gray-300 font-bold">
            ระบบกำลังอยู่ในช่วงพัฒนา
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ยังไม่เปิดให้บริการในขณะนี้ รอติดตามอัปเดตใหม่ ๆ ได้เร็ว ๆ นี้ครับ
          </p>
        </div>

        <button 
          onClick={() => router.push('/games/pokdeng')} 
          className="mt-4 px-8 py-3 bg-gradient-to-r from-purple-700 to-purple-900 hover:from-purple-600 hover:to-purple-800 rounded-xl font-black text-white text-base transition active:scale-95 shadow-lg shadow-purple-900/50"
        >
          ← กลับหน้าเลือกโหมด
        </button>
      </div>

    </div>
  )
}
