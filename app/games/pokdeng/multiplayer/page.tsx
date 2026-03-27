// src/app/games/pokdeng/page.tsx
'use client'
import React from 'react'
import { useRouter } from 'next/navigation'

export default function PokdengMultiplayer() {
  const router = useRouter()

  return (
    <div 
      className="flex flex-col min-h-screen w-full bg-slate-950 text-white font-['Google_Sans'] overflow-hidden bg-cover bg-center bg-fixed relative select-none"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      {/* Overlay ให้พื้นหลังมืดลงนิดหน่อยเพื่อให้ข้อความเด่นขึ้น */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
        
        {/* ไอคอนไพ่ตกแต่ง */}
        <div className="flex justify-center gap-4 md:gap-8 mb-10 md:mb-14 animate-bounce duration-[3000ms]">
          <div className="w-16 h-24 md:w-24 md:h-36 bg-white rounded-xl md:rounded-2xl text-red-600 flex items-center justify-center text-4xl md:text-6xl shadow-[0_0_30px_rgba(255,255,255,0.2)] -rotate-12 border-2 border-gray-300">
            ♥️
          </div>
          <div className="w-16 h-24 md:w-24 md:h-36 bg-gray-900 rounded-xl md:rounded-2xl text-yellow-500 flex items-center justify-center text-4xl md:text-6xl shadow-[0_0_40px_rgba(250,204,21,0.4)] z-10 border-2 border-yellow-500/50">
            ♠️
          </div>
          <div className="w-16 h-24 md:w-24 md:h-36 bg-white rounded-xl md:rounded-2xl text-black flex items-center justify-center text-4xl md:text-6xl shadow-[0_0_30px_rgba(255,255,255,0.2)] rotate-12 border-2 border-gray-300">
            ♣️
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 mb-6 drop-shadow-lg font-['Fahkwang'] uppercase tracking-tighter">
          POKDENG
        </h1>
        
        <div className="bg-black/80 border border-yellow-900/50 rounded-full px-8 py-3 mb-8 shadow-[0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-md inline-block">
          <span className="text-yellow-500 font-bold tracking-[0.3em] uppercase text-sm md:text-base animate-pulse">
            Multiplayer Arena
          </span>
        </div>

        <h2 className="text-2xl md:text-4xl font-bold text-gray-300 mb-4">
          ยังไม่พร้อมให้บริการในขณะนี้
        </h2>
        
        <p className="text-gray-500 max-w-lg mx-auto text-sm md:text-lg mb-12 leading-relaxed">
          ระบบการเล่นป๊อกเด้งแบบหลายคนกำลังอยู่ในระหว่างการพัฒนาและทดสอบ เพื่อประสบการณ์การเล่นที่ลื่นไหลและดีที่สุดสำหรับคุณ เตรียมพบกัน เร็ว ๆ นี้ !
        </p>

        <button 
          onClick={() => router.push('/')} // หรือเปลี่ยนเป็น '/lobby' ตามโครงสร้างโปรเจกต์ของคุณ
          className="group relative px-8 py-4 bg-white text-black font-black rounded-full text-lg uppercase tracking-widest overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-yellow-400 to-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <span className="relative z-10 group-hover:text-white transition-colors duration-300 flex items-center gap-3">
            <span>⬅️</span> กลับสู่หน้าหลัก
          </span>
        </button>

      </div>
      
      {/* Footer text */}
      <div className="relative z-10 pb-6 text-center opacity-30 text-[10px] tracking-[0.5em] font-black uppercase text-gray-400">
        Stellar Engine • Core System
      </div>
    </div>
  )
}
