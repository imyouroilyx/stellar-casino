// app/page.tsx
'use client'
import React from 'react'
import Link from 'next/link'

export default function HomePage() {
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

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="font-['Fahkwang'] text-center text-gray-700 uppercase tracking-[0.4em] sm:tracking-[0.5em]
                         border-t border-gray-900 bg-[#050505]
                         p-6 sm:p-8 md:p-10 lg:p-12
                         text-[9px] sm:text-[10px] md:text-[11px]">
        © 2026 Stellar Paradise. Official Global Provider for RoleplayTH.com
      </footer>
    </div>
  )
}
