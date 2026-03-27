'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([])

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // ดึงข้อมูลผู้เล่นทุกคน เรียงตามเงินจากมากไปน้อย
      const { data } = await supabase
        .from('profiles')
        .select('username, balance, avatar_url')
        .order('balance', { ascending: false })
      
      if (data) setLeaderboard(data)
    }
    fetchLeaderboard()
  }, [])

  const games = [
    { 
      id: 1, 
      name: 'ไพ่แคง', 
      href: '/games/kaeng', 
      image: 'https://i.pinimg.com/736x/05/e0/95/05e095a6df3e5de682e1bb240e967415.jpg'
    },
    { 
      id: 2, 
      name: 'ป๊อกเด้ง', 
      href: '/games/pokdeng', 
      image: 'https://i.pinimg.com/736x/da/84/de/da84de1f7190142f164bd83bd8262aab.jpg'
    },
    { 
      id: 3, 
      name: 'วงล้อเสี่ยงโชค', 
      href: '/games/wheel', 
      image: 'https://i.pinimg.com/1200x/f7/77/e0/f777e0a3d334672b4dc4990f9ec34245.jpg' 
    },
    { 
      id: 4, 
      name: 'สล็อตแมชชีน', 
      href: '/games/slot',
      image: 'https://i.pinimg.com/736x/3f/65/0c/3f650c2b544cdf090f2399816728b9b9.jpg' 
    },
    { 
      id: 5, 
      name: 'ไฮโล', 
      href: '/games/hilo', 
      image: 'https://i.pinimg.com/1200x/86/ee/a9/86eea9da8a39a38b64f220d87bb0fc70.jpg' 
    },
    { 
      id: 6, 
      name: 'เดอะล็อตโต้', 
      href: '/games/fish-prawn-crab', 
      image: 'https://i.pinimg.com/736x/d3/01/b9/d301b9ba0d9d64471063f84baa57e9ff.jpg' 
    },
  ]

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen">
      {/* ─── Styles ซ่อน Scrollbar ────────────────────────────────────────── */}
      <style>{`
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ─── Banner ─────────────────────────────────────────────────────── */}
      <section className="relative bg-[#0a0a0a] border-b border-gray-900 flex items-center justify-center overflow-hidden
                          h-[280px] sm:h-[340px] md:h-[400px] lg:h-[420px]">

        {/* BG image */}
        <div className="absolute inset-0 opacity-25">
          <img
            src="https://iili.io/qQby95u.png"
            className="w-full h-full object-cover scale-110"
            alt="Banner"
          />
        </div>

        <div className="relative z-10 text-center px-4 sm:px-6">
          {/* Logo */}
          <img
            src="https://iili.io/qQNVmS1.png"
            className="mx-auto mb-4 sm:mb-6 md:mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]
                       animate-in fade-in zoom-in duration-1000
                       w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28"
            alt="Logo"
          />

          {/* Title */}
          <h1 className="font-['Fahkwang'] font-bold tracking-tighter uppercase text-white
                         animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both
                         text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl
                         mb-3 sm:mb-4 md:mb-6">
            Stellar Paradise
          </h1>

          {/* Divider */}
          <div className="h-px w-16 sm:w-20 md:w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent
                          mx-auto mb-4 sm:mb-6 md:mb-8 rounded-full
                          animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300" />

          {/* Subtitle */}
          <p className="font-['Google_Sans'] font-bold text-[#a0b1c3] uppercase drop-shadow-md
                        animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both
                        text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl
                        tracking-[0.15em] sm:tracking-[0.2em]">
            วันนี้จะเสียเงินเท่าไรดี ?
          </p>
        </div>
      </section>

      {/* ─── Game Grid ──────────────────────────────────────────────────── */}
      <section className="flex-1 max-w-[1200px] mx-auto w-full
                          px-4 py-8
                          sm:px-6 sm:py-10
                          md:px-8 md:py-12
                          lg:px-12 lg:py-12">

        {/* Section label */}
        <h2 className="font-['Google_Sans'] font-bold text-gray-600 uppercase tracking-[0.2em]
                       border-l-2 sm:border-l-4 border-white pl-3 sm:pl-6 leading-none
                       text-[10px] sm:text-xs
                       mb-6 sm:mb-8 md:mb-10 lg:mb-12">
          Available Games — เกมที่เปิดให้บริการ
        </h2>

        {/* Grid */}
        <div className="grid gap-6 sm:gap-8 md:gap-10 lg:gap-12
                        grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game, index) => (
            <Link
              href={game.href}
              key={game.id}
              className="group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: `${(index + 1) * 150}ms` }}
            >
              {/* Card */}
              <div className="aspect-[4/3] bg-[#080808] border border-gray-900 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem]
                              flex flex-col items-center justify-center
                              group-hover:border-white/40 group-hover:-translate-y-1 sm:group-hover:-translate-y-2
                              transition-all duration-500 shadow-2xl relative overflow-hidden">

                {/* Game image */}
                {game.image ? (
                  <img
                    src={game.image}
                    className="absolute inset-0 w-full h-full object-cover
                               opacity-40 group-hover:opacity-100 group-hover:scale-110
                               transition-all duration-700"
                    alt={game.name}
                  />
                ) : (
                  <div className="text-4xl sm:text-5xl opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
                    🎰
                  </div>
                )}

                {/* Click to play label */}
                <div className="relative z-10 font-['Fahkwang'] text-white/50 font-bold uppercase tracking-widest
                                mt-4 sm:mt-6 opacity-0 group-hover:opacity-100 transition-opacity
                                text-[8px] sm:text-[10px]">
                  Click to Play
                </div>

                {/* Bottom gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
              </div>

              {/* Game name */}
              <div className="mt-3 sm:mt-5 md:mt-6 lg:mt-8 text-center">
                <div className="font-['Google_Sans'] font-bold uppercase text-gray-500
                                group-hover:text-white transition-all duration-300
                                text-base sm:text-lg md:text-xl lg:text-2xl">
                  {game.name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Leaderboard Dashboard ──────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto w-full px-4 sm:px-6 md:px-8 lg:px-12 pb-16">
        <h2 className="font-['Google_Sans'] font-bold text-yellow-600 uppercase tracking-[0.2em]
                       border-l-2 sm:border-l-4 border-yellow-600 pl-3 sm:pl-6 leading-none
                       text-[10px] sm:text-xs mb-6 sm:mb-8 md:mb-10">
          Wealth Leaderboard — ทำเนียบมหาเศรษฐี
        </h2>

        {/* กรอบ Dashboard ซ่อน scrollbar */}
        <div className="bg-[#080808] border border-gray-900 rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl 
                        h-[400px] overflow-y-auto hide-scroll relative">
          
          <div className="flex flex-col gap-3">
            {leaderboard.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* อันดับ */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm shrink-0
                    ${index === 0 ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]' :
                      index === 1 ? 'bg-gray-300 text-black' :
                      index === 2 ? 'bg-orange-400 text-black' : 'bg-gray-800 text-white'}`}>
                    #{index + 1}
                  </div>
                  
                  {/* รูปโปรไฟล์ */}
                  <img 
                    src={user.avatar_url || 'https://iili.io/qQNVmS1.png'} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-gray-700" 
                    alt="avatar" 
                  />
                  
                  {/* ชื่อ */}
                  <div className="font-bold text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">
                    {user.username}
                  </div>
                </div>

                {/* จำนวนเงิน */}
                <div className="font-mono font-black text-yellow-500 text-sm sm:text-lg">
                  ${(user.balance || 0).toLocaleString()}
                </div>
              </div>
            ))}

            {/* สถานะโหลดข้อมูล */}
            {leaderboard.length === 0 && (
              <div className="text-center text-gray-600 text-xs sm:text-sm py-10 font-bold uppercase tracking-widest animate-pulse">
                Loading Data...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-900 bg-[#050505] p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col items-center justify-center gap-5">
        
        {/* Warning Message */}
        <div className="font-['Google_Sans'] text-[10px] sm:text-xs text-red-500/80 bg-red-900/10 border border-red-900/30 px-5 py-2.5 rounded-full font-bold tracking-widest text-center shadow-inner">
          ⚠️ เว็บไซต์นี้จัดทำขึ้นเพื่อความบันเทิงเท่านั้น ไม่สนับสนุนการเล่นการพนันด้วยเงินจริงในทุกรูปแบบ
        </div>

        {/* Copyright */}
        <div className="font-['Fahkwang'] text-center text-gray-700 uppercase tracking-[0.4em] sm:tracking-[0.5em] text-[9px] sm:text-[10px] md:text-[11px]">
          © 2026 Stellar Paradise. Official Global Provider for RoleplayTH.com
        </div>

      </footer>
    </div>
  )
}
