// src/components/Navigation.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { supabase } from '@/lib/supabase'

export function Sidebar() {
  const { profile } = useUser()
  const pathname = usePathname()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'staff'

  return (
    <aside className="w-20 border-r border-gray-900 flex flex-col items-center py-10 space-y-12 bg-[#050505] sticky top-0 h-screen z-50">
      <a href="https://roleplayth.com/index.php"><img src="https://iili.io/qQNVmS1.png" className="w-12 h-12 hover:opacity-80 transition" alt="Logo" /></a>
      <nav className="flex flex-col space-y-10">
        <NavLink href="/" icon="https://img.icons8.com/?size=100&id=2797&format=png&color=FFFFFF" active={pathname === '/'} />
        {profile && (
          <>
            <NavLink href="/finance" icon="https://img.icons8.com/?size=100&id=22185&format=png&color=FFFFFF" active={pathname === '/finance'} />
            <NavLink href="/profile" icon="https://img.icons8.com/?size=100&id=ywULFSPkh4kI&format=png&color=FFFFFF" active={pathname === '/profile'} />
            {isAdmin && <NavLink href="/management" icon="https://img.icons8.com/?size=100&id=2969&format=png&color=FFFFFF" active={pathname === '/management'} />}
          </>
        )}
      </nav>
    </aside>
  )
}

function NavLink({ href, icon, active }: { href: string, icon: string, active: boolean }) {
  return (
    <Link href={href} className={`${active ? 'opacity-100' : 'opacity-40'} hover:opacity-100 transition hover:scale-110`}>
      <img src={icon} className="w-7 h-7" alt="Nav Icon" />
    </Link>
  )
}

export function Header() {
  const { profile, setProfile } = useUser()

  const handleLogout = async () => {
    // 1. ลบเซสชันจาก Supabase
    await supabase.auth.signOut()
    
    // 2. ล้างข้อมูลใน Context ทันที
    setProfile(null)

    // 3. ✅ ใช้คำสั่งนี้เพื่อบังคับ "ดีด" ไปหน้าล็อกอิน และ เคลียร์หน้าเว็บให้สะอาด 100%
    window.location.href = '/login'
  }

  return (
    <header className="flex justify-between items-center px-10 py-6 border-b border-gray-900 bg-[#050505] sticky top-0 z-40 font-['Fahkwang']">
      <div className="flex flex-col">
        <span className="text-[15px] text-gray-600 font-bold uppercase tracking-tight mb-1 leading-none">สวรรค์ของนักพนันทั่วทุกมุมโลก</span>
        <span className="text-xl font-bold text-white uppercase tracking-tight leading-none">STELLAR PARADISE</span>
      </div>
      <div>
        {profile ? (
          <div className="flex items-center space-x-4 bg-[#0a0a0a] p-1.5 pr-5 rounded-full border border-gray-800 shadow-lg transition hover:border-gray-600">
            <Link href="/profile" className="flex items-center space-x-4">
              <img src={profile.avatar_url || 'https://i.imgur.com/6VBx3io.png'} className="w-10 h-10 rounded-full border border-gray-700 object-cover" alt="Avatar" />
              <div className="text-right">
                <div className="text-sm font-bold text-white leading-tight font-['Google_Sans']">{profile.username}</div>
                <div className="text-xs text-yellow-500 font-bold mt-0.5 font-['Google_Sans']">$ {profile.balance?.toLocaleString()}</div>
              </div>
            </Link>
            <button 
              onClick={handleLogout} 
              className="ml-3 opacity-40 hover:opacity-100 transition group border-none bg-transparent p-0 cursor-pointer"
            >
              <img src="https://img.icons8.com/?size=100&id=NFrZcFKaLXs7&format=png&color=FFFFFF" className="w-5 h-5" alt="Logout" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-6 font-['Google_Sans']">
            <Link href="/login" className="text-sm font-bold text-gray-400 hover:text-white transition">เข้าสู่ระบบ</Link>
            <Link href="/register" className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition">สมัครสมาชิก</Link>
          </div>
        )}
      </div>
    </header>
  )
}