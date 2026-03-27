// src/app/games/slot/page.tsx
'use client'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

// ✅ อีโมจิธีมอวกาศและคาสิโน
const SYMBOL_DATA = [
  { text: '💎', color: 'text-cyan-400' },
  { text: '🌟', color: 'text-yellow-300' },
  { text: '🚀', color: 'text-red-400' },
  { text: '🎰', color: 'text-orange-400' },
  { text: '7️⃣', color: 'text-red-500' },
  { text: '🪐', color: 'text-purple-400' },
  { text: '☄️', color: 'text-orange-500' }
]

const CONFETTI_COLORS = ['bg-blue-500', 'bg-orange-500', 'bg-pink-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-purple-500']
const REEL_SYMBOLS = [...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA, ...SYMBOL_DATA];

export default function SlotGame() {
  const { profile, loading: userLoading, syncUser } = useUser()
  
  const [spinning, setSpinning] = useState(false)
  const [stopping, setStopping] = useState([false, false, false]) 
  const [bet, setBet] = useState(10)
  const [results, setResults] = useState([0, 0, 0])
  
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState({ status: '', amount: 0, msg: '' })
  const [isWinner, setIsWinner] = useState(false) 

  const spinSnd = useRef<HTMLAudioElement | null>(null)
  const stopSnd = useRef<HTMLAudioElement | null>(null)
  const winSnd = useRef<HTMLAudioElement | null>(null)
  const loseSnd = useRef<HTMLAudioElement | null>(null)
  const jackpotSnd = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    spinSnd.current = new Audio('/sounds/Spin.wav');
    if(spinSnd.current) spinSnd.current.loop = false;
    
    stopSnd.current = new Audio('/sounds/Stop.wav');
    winSnd.current = new Audio('/sounds/Win.wav');
    loseSnd.current = new Audio('/sounds/Lose.wav');
    jackpotSnd.current = new Audio('/sounds/Jackpot.wav');
  }, [])

  const playEffect = (audio: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audio.current) {
      audio.current.currentTime = 0;
      audio.current.play().catch(() => {});
    }
  }

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (isNaN(value)) {
      setBet(0);
    } else {
      setBet(value);
    }
  }

  const playSlot = async () => {
    if (spinning || !profile) return
    if (bet <= 0) return alert('กรุณาใส่ยอดเดิมพันที่มากกว่า 0')
    if (profile.balance < bet) return alert('ยอดเงินของคุณไม่เพียงพอ !')

    setShowModal(false)
    setIsWinner(false) 
    setSpinning(true)
    setStopping([false, false, false])
    playEffect(spinSnd)

    try {
      await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', profile.id)
      await syncUser()

      const finalResults = [
        Math.floor(Math.random() * SYMBOL_DATA.length),
        Math.floor(Math.random() * SYMBOL_DATA.length),
        Math.floor(Math.random() * SYMBOL_DATA.length)
      ]
      setResults(finalResults)

      setTimeout(() => { 
        setStopping(prev => [true, prev[1], prev[2]]); 
        playEffect(stopSnd); 
      }, 2000)
      
      setTimeout(() => { 
        setStopping(prev => [prev[0], true, prev[2]]); 
        playEffect(stopSnd); 
      }, 4000)
      
      setTimeout(async () => {
        setStopping([true, true, true])
        setSpinning(false)
        
        if (spinSnd.current) {
          spinSnd.current.pause();
          spinSnd.current.currentTime = 0;
        }
        
        playEffect(stopSnd)

        let winAmount = 0; let statusText = 'แพ้'; let status = 'lose';
        if (finalResults[0] === finalResults[1] && finalResults[1] === finalResults[2]) {
          winAmount = bet * 10; status = 'jackpot'; statusText = 'ชนะ (Jackpot)';
        } else if (finalResults[0] === finalResults[1] || finalResults[1] === finalResults[2] || finalResults[0] === finalResults[2]) {
          winAmount = bet * 2; status = 'win'; statusText = 'ชนะ';
        }

        if (winAmount > 0) {
          const { data: curr } = await supabase.from('profiles').select('balance').eq('id', profile.id).single()
          await supabase.from('profiles').update({ balance: (curr?.balance || 0) + winAmount }).eq('id', profile.id)
        }

        await supabase.from('game_logs').insert([{
          user_id: profile.id, game_name: 'Stellar Slot', change_amount: winAmount > 0 ? winAmount : -bet, result: statusText
        }])

        setModalData({ 
          status, 
          amount: winAmount, 
          msg: winAmount > 0 
            ? `ยินดีด้วยนะ! รับเงินไป $ ${winAmount.toLocaleString()}` 
            : 'เสียใจด้วยนะ ลองใหม่จ้า' 
        })
        
        setTimeout(() => { 
          if (status === 'jackpot') { playEffect(jackpotSnd); setIsWinner(true); }
          else if (status === 'win') { playEffect(winSnd); setIsWinner(true); }
          else { playEffect(loseSnd); }
          
          setShowModal(true); 
          syncUser(); 
        }, 500)

      }, 6000)

    } catch (err) {
      setSpinning(false);
      if (spinSnd.current) {
        spinSnd.current.pause();
        spinSnd.current.currentTime = 0;
      }
    }
  }

  const confettiPieces = useMemo(() => {
    if (!isWinner) return []
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      delay: `${Math.random() * 0.5}s`, 
      duration: `${Math.random() * 1.5 + 1.5}s`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      width: `${Math.random() * 8 + 6}px`,
      height: `${Math.random() * 12 + 8}px`,
    }))
  }, [isWinner])

  return (
    <div 
      className="min-h-screen text-white font-['Google_Sans'] flex items-center justify-center p-6 md:p-12 relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('https://iili.io/qZ3dyUg.png')" }}
    >
      
      {isWinner && (
        <div className="fixed inset-0 pointer-events-none z-[90] overflow-hidden">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className={`absolute top-[-10%] ${p.color} opacity-80`}
              style={{
                left: p.left,
                width: p.width,
                height: p.height,
                animation: `fallAndSpin ${p.duration} ease-in ${p.delay} forwards` 
              }}
            />
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slotSpin {
          0% { transform: translateY(0); }
          100% { transform: translateY(-${(REEL_SYMBOLS.length - 1) * 100 / REEL_SYMBOLS.length}%); }
        }
        @keyframes fallAndSpin {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(60vh) rotate(720deg) scale(0.5); opacity: 0; } 
        }
        .spinning-reel { animation: slotSpin 0.2s linear infinite; }
        .stopped-reel { transition: transform 1.2s cubic-bezier(0.17, 0.67, 0.2, 1.05); }
        .neon-border { box-shadow: 0 0 20px rgba(255, 215, 0, 0.2), inset 0 0 20px rgba(255, 215, 0, 0.1); }
      `}} />

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-start z-10">
        
        <div className="lg:col-span-7 flex flex-col items-center space-y-12">
          <div className="text-center animate-in fade-in slide-in-from-top-4 duration-1000">
            <h1 className="font-['Fahkwang'] text-6xl md:text-7xl font-bold uppercase tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">
              SLOT MACHINE
            </h1>
            <p className="text-2xl font-bold text-[#a0b1c3] uppercase tracking-widest drop-shadow-md">วันนี้จะเสียเงินเท่าไรดี ?</p>
          </div>

          <div className="bg-[#080808]/80 border-[8px] border-yellow-900/50 p-8 md:p-10 rounded-[4rem] shadow-2xl relative neon-border backdrop-blur-sm overflow-hidden">
            <div className="flex space-x-4 md:space-x-8 h-40 md:h-56 overflow-hidden bg-black/80 rounded-3xl relative border border-white/5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-28 md:w-40 relative overflow-hidden">
                  <div 
                    className={`flex flex-col w-full absolute top-0 left-0 ${(!stopping[i] && spinning) ? 'spinning-reel' : 'stopped-reel'}`}
                    style={{
                      transform: (!stopping[i] && spinning) 
                        ? 'none' 
                        : `translateY(-${(results[i] + (SYMBOL_DATA.length * (REEL_SYMBOLS.length / SYMBOL_DATA.length - 1))) * (100 / REEL_SYMBOLS.length)}%)`
                    }}
                  >
                    {REEL_SYMBOLS.map((s, idx) => (
                      <div key={idx} className={`h-40 md:h-56 w-full flex items-center justify-center text-5xl md:text-7xl font-extrabold uppercase shrink-0 ${s.color} drop-shadow-[0_0_8px_currentColor]`}>
                        {s.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] z-20"></div>
            </div>
          </div>

          <div className="w-full max-w-md space-y-10">
            {/* ✅ ส่วน Bet Amount ที่กดบวก ลบ และพิมพ์เลขได้ */}
            <div className="flex justify-between items-center bg-white/5 border border-white/5 p-6 rounded-[2rem] backdrop-blur-sm">
               <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-4">Bet Amount</span>
               <div className="flex items-center space-x-4">
                  <button 
                    disabled={spinning}
                    onClick={() => setBet(Math.max(0, bet - 10))} 
                    className="text-2xl opacity-40 hover:opacity-100 transition disabled:opacity-10"
                  >
                    －
                  </button>
                  <div className="flex items-center">
                    <span className="text-4xl font-bold text-yellow-500 mr-2">$</span>
                    <input 
                      type="number" 
                      value={bet}
                      onChange={handleBetChange}
                      disabled={spinning}
                      className="bg-transparent text-4xl font-bold text-yellow-500 w-24 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button 
                    disabled={spinning}
                    onClick={() => setBet(bet + 10)} 
                    className="text-2xl opacity-40 hover:opacity-100 transition disabled:opacity-10"
                  >
                    ＋
                  </button>
               </div>
            </div>
            <button 
              onClick={playSlot} 
              disabled={spinning}
              className={`w-full py-8 rounded-full font-bold text-xl uppercase tracking-[0.2em] transition-all duration-300 ${spinning ? 'bg-gray-900 text-gray-700' : 'bg-white text-black hover:bg-yellow-500 shadow-2xl scale-100 active:scale-95'}`}
            >
              {spinning ? 'กำลังหมุน...' : 'หมุนเลย!'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#080808]/80 border border-gray-900 p-12 rounded-[3.5rem] sticky top-12 shadow-2xl backdrop-blur-sm z-10 relative">
           <h2 className="font-['Fahkwang'] text-4xl font-bold uppercase tracking-tighter mb-10 border-l-8 border-white pl-8">
              RULES
           </h2>
           <div className="space-y-12 text-gray-400 font-['Google_Sans']">
              <div className="p-8 bg-black/40 border border-gray-900 rounded-[2.5rem]">
                 <p className="text-yellow-500 font-bold mb-4 uppercase text-2xl tracking-widest">Jackpot x10</p>
                 <p className="text-xl leading-relaxed">สัญลักษณ์เหมือนกัน <span className="text-white font-bold">3 ช่อง</span> รับเงินรางวัล 10 เท่า ทันที เสียวเว่อร์</p>
              </div>
              <div className="p-8 bg-black/40 border border-gray-900 rounded-[2.5rem]">
                 <p className="text-blue-400 font-bold mb-4 uppercase text-2xl tracking-widest">Normal Win x2</p>
                 <p className="text-xl leading-relaxed">สัญลักษณ์เหมือนกันแค่ <span className="text-white font-bold">2 ช่อง</span> รับรางวัล 2 เท่าไปเลยจ้า</p>
              </div>
              <div className="pt-10 border-t border-gray-900 text-center">
                 <p className="text-xl text-gray-600 uppercase tracking-widest italic">
                    ขอให้สนุกกับการลุ้นนะจ๊ะ <br/> อย่าเล่นจนไม่มีเงินไปกินข้าวล่ะ
                 </p>
              </div>
           </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto">
          <div className={`w-full max-w-md bg-[#0a0a0a]/90 border-2 p-16 rounded-[4rem] text-center shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-20 duration-700 my-8 ${modalData.status === 'lose' ? 'border-red-900/50' : 'border-yellow-500/50'}`}>
            <h3 className={`text-5xl font-black uppercase tracking-tighter mb-8 font-['Fahkwang'] ${modalData.status === 'lose' ? 'text-red-600' : 'text-green-500'}`}>
              {modalData.status === 'lose' ? 'แพ้ซะแล้ว' : 'ยินดีด้วย!'}
            </h3>
            <p className="text-[#a0b1c3] text-2xl mb-12 leading-relaxed font-bold">
              {modalData.msg}
            </p>
            <button onClick={() => setShowModal(false)} className="w-full py-6 bg-white text-black font-bold rounded-full text-sm uppercase tracking-[0.1em] hover:bg-gray-200">
              เล่นต่อเลย!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}