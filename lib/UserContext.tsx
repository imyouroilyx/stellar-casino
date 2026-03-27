// src/lib/UserContext.tsx

'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

import { supabase } from '@/lib/supabase'



const UserContext = createContext<any>(null)



export const UserProvider = ({ children }: { children: React.ReactNode }) => {

const [profile, setProfile] = useState<any>(null)

const [loading, setLoading] = useState(true)



// ฟังก์ชันดึงข้อมูล หรือ ล้างข้อมูล

const syncUser = async () => {

try {

const { data: { session } } = await supabase.auth.getSession()


if (session?.user) {

const { data } = await supabase

.from('profiles')

.select('*')

.eq('id', session.user.id)

.single()


if (data) {

setProfile(data)

} else {

setProfile(null)

}

} else {

// ✅ ถ้าไม่มี Session ให้ล้างค่า Profile ทันที

setProfile(null)

}

} catch (error) {

console.error("Error syncing user:", error)

setProfile(null)

} finally {

setLoading(false)

}

}



useEffect(() => {

syncUser()



// คอยดักฟังว่ามีการ Login หรือ Logout ไหม

const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

if (event === 'SIGNED_OUT') {

setProfile(null)

} else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {

syncUser()

}

})



return () => subscription.unsubscribe()

}, [])



return (

<UserContext.Provider value={{ profile, loading, syncUser, setProfile }}>

{children}

</UserContext.Provider>

)

}



export const useUser = () => useContext(UserContext)