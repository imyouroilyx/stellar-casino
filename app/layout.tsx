// src/app/layout.tsx
import { UserProvider } from '@/lib/UserContext'
import { Sidebar, Header } from '@/components/Navigation'
import './globals.css'

export const metadata = {
  title: 'Stellar Paradise - RoleplayTH',
  description: 'Official Gaming Platform for RoleplayTH',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Fahkwang:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;1,200;1,300;1,400;1,500;1,600;1,700&family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-black text-white selection:bg-white selection:text-black">
        <UserProvider>
          <div className="flex min-h-screen">
            {/* Sidebar สว่างตามหน้าอัตโนมัติ */}
            <Sidebar />
            
            <div className="flex-1 flex flex-col">
              {/* Header ที่มีโปรไฟล์ลิงก์ไปหน้า Profile */}
              <Header />
              
              {/* เนื้อหาแต่ละหน้าจะมาอยู่ตรงนี้ */}
              <main className="flex-1 overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </UserProvider>
      </body>
    </html>
  )
}