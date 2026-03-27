// app/page.tsx
'use client'
import React from 'react'
import Link from 'next/link'

export default function HomePage() {
  // เพิ่ม href เพื่อลิงก์ไปหน้าเกม และ image สำหรับใส่รูปภาพ
  const games = [
    { 
      id: 1, 
      name: 'ไพ่แคง', 
      href: '/games/kaeng', 
      image: 'https://cdn.britannica.com/95/124395-004-3B484C8B/hand-cards-trump-spades.jpg' // ใส่ URL รูปภาพตรงนี้ครับ
    },
    { 
      id: 2, 
      name: 'ป๊อกเด้ง', 
      href: '/games/pokdeng', 
      image: 'https://thaiplayingcard.com/wp-content/uploads/2023/07/%E0%B9%84%E0%B8%9E%E0%B9%88%E0%B8%9B%E0%B9%8A%E0%B8%AD%E0%B8%81%E0%B9%80%E0%B8%94%E0%B9%89%E0%B8%87-%E0%B8%9B%E0%B8%81-2.jpg' // ถ้าเว้นว่างไว้ ระบบจะโชว์ไอคอนสำรองให้เอง
    },
    { 
      id: 3, 
      name: 'วงล้อเสี่ยงโชค', 
      href: '/games/wheel', 
      image: 'https://cdn.dribbble.com/userupload/21654402/file/original-98598f1136f0ef47de974c47e8818b15.png?resize=752x&vertical=center' 
    },
    { 
      id: 4, 
      name: 'สล็อตแมชชีน', 
      href: '/games/slot', // เชื่อมไปยังหน้าที่เราสร้างไว้
      image: 'https://www.egt.com/wp-content/uploads/2025/01/what-is-a-slot-machine.webp' 
    },
    { 
      id: 5, 
      name: 'ไฮโล', 
      href: '/games/hilo', 
      image: 'https://static1.squarespace.com/static/52d4acc0e4b086fdf73bb33b/t/54495d52e4b003f5baba3ad6/1414094162931/?format=1500w' 
    },
    { 
      id: 6, 
      name: 'น้ำเต้าปูปลา', 
      href: '/games/fish-prawn-crab', 
      image: 'https://i.pinimg.com/736x/d8/01/1b/d8011be5fce755eac289640cc864727d.jpg' 
    },
  ]

  return (
    <div className="flex flex-col bg-black text-white font-['Google_Sans'] min-h-screen">
      
      {/* --- Banner Section --- */}
      <section className="relative h-[420px] bg-[#0a0a0a] border-b border-gray-900 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <img src="https://iili.io/qQby95u.png" className="w-full h-full object-cover scale-110" alt="Banner" />
        </div>
        
        <div className="relative z-10 text-center px-6">
           <img 
              src="https://iili.io/qQNVmS1.png" 
              className="w-28 h-28 mx-auto mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] animate-in fade-in zoom-in duration-1000" 
              alt="Logo" 
           />
           
           <h1 className="font-['Fahkwang'] text-5xl md:text-7xl font-bold tracking-tighter uppercase text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
              Stellar Paradise
           </h1>
           
           <div className="h-1 w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent mx-auto mb-8 rounded-full animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300"></div>
           
           {/* ข้อความขนาด 2xl สี #a0b1c3 พร้อม Animation */}
           <p className="font-['Google_Sans'] text-2xl font-bold text-[#a0b1c3] uppercase tracking-[0.2em] drop-shadow-md animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
              วันนี้จะเสียเงินเท่าไรดี ?
           </p>
        </div>
      </section>

      {/* --- Game Grid --- */}
      <section className="p-12 flex-1 max-w-[1200px] mx-auto w-full">
         <h2 className="font-['Google_Sans'] text-sm font-bold text-gray-600 mb-12 uppercase tracking-[0.2em] border-l-4 border-white pl-6 leading-none">
            Available Games — เกมที่เปิดให้บริการ
         </h2>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {games.map((game, index) => (
              <Link 
                href={game.href} 
                key={game.id} 
                className="group cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${(index + 1) * 150}ms` }}
              >
                {/* ตัว Card เกม */}
                <div className="aspect-[4/3] bg-[#080808] border border-gray-900 rounded-[2.5rem] flex flex-col items-center justify-center group-hover:border-white/40 group-hover:-translate-y-2 transition-all duration-500 shadow-2xl relative overflow-hidden">
                   
                   {/* แสดงรูปภาพถ้ามี ถ้าไม่มีแสดงไอคอน 🎰 */}
                   {game.image ? (
                     <img 
                        src={game.image} 
                        className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                        alt={game.name} 
                     />
                   ) : (
                     <div className="text-5xl opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">🎰</div>
                   )}

                   <div className="relative z-10 font-['Fahkwang'] text-[10px] text-white/50 font-bold uppercase tracking-widest mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to Play
                   </div>

                   {/* Overlay ไล่เฉดสีดำเพื่อให้ชื่อเกมด้านล่างอ่านง่ายขึ้น */}
                   <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                </div>

                <div className="mt-8 text-center">
                  <div className="font-['Google_Sans'] text-2xl font-bold uppercase text-gray-500 group-hover:text-white transition-all duration-300">
                     {game.name}
                  </div>
                </div>
              </Link>
            ))}
         </div>
      </section>

      <footer className="font-['Fahkwang'] p-12 text-center text-[11px] text-gray-700 uppercase tracking-[0.5em] border-t border-gray-900 bg-[#050505]">
         © 2026 Stellar Paradise. Official Global Provider for RoleplayTH.com
      </footer>
    </div>
  )
}