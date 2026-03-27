// src/app/games/kaeng/page.tsx
'use client'
import React from 'react'
import Link from 'next/link'

export default function KaengComingSoon() {
  return (
    <div className="flex h-screen w-full bg-[#0a0f16] text-white font-['Google_Sans'] overflow-hidden select-none items-center justify-center relative"
         style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      
      {/* Overlay เพิ่มความมืดให้เห็นตัวอักษรชัดๆ */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div className="z-10 flex flex-col items-center text-center p-12 bg-black/40 rounded-[4rem] border border-white/10 shadow-2xl backdrop-blur-md max-w-2xl">
        <div className="text-8xl mb-8 animate-pulse">🃏</div>
        
        <h1 className="text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-4 uppercase tracking-tighter">
          ไพ่แคง
        </h1>
        
        <div className="h-1 w-32 bg-yellow-500 mb-8 rounded-full"></div>
        
        <p className="text-4xl font-bold text-gray-300 mb-12">
          ยังไม่เปิดให้บริการ
        </p>

        <p className="text-gray-500 font-medium mb-12 max-w-sm">
          ระบบกำลังอยู่ระหว่างการพัฒนาดวงดาวดวงนี้ <br /> 
          โปรดรอติดตามความสนุกเร็วๆ นี้!
        </p>

        <Link href="/" className="px-12 py-5 bg-white text-black font-black rounded-full text-2xl hover:bg-yellow-500 transition-all shadow-xl active:scale-95">
          ⬅ กลับไปเลือกเกมอื่น
        </Link>
      </div>

      <div className="absolute bottom-8 text-[10px] text-gray-600 uppercase tracking-[1em] opacity-30">
        Stellar Construction Unit
      </div>
    </div>
  )
}