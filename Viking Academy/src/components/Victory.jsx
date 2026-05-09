import { useEffect } from "react";

const Victory = ({ mod, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: ["#4A9EFF","#00C8A0","#F5B638","#A78BFA","#FF6B6B","#FFF"][Math.floor(Math.random() * 6)],
    size: Math.random() * 8 + 4,
    dur: Math.random() * 1.5 + 1.5,
  }));

  return (
    <div style={{ position:"fixed", inset:0, zIndex:800, pointerEvents:"none", overflow:"hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:`${p.x}%`, top:"-20px",
          width:p.size, height:p.size, borderRadius: p.size > 8 ? "50%" : "2px",
          background:p.color, opacity:0.9,
          animation:`confettiDrop ${p.dur}s ${p.delay}s ease-in forwards`,
        }}/>
      ))}
      <div style={{
        position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        background:"linear-gradient(135deg,#0D1830,#0A1222)",
        border:`2px solid ${mod.color}60`, borderRadius:20, padding:"32px 48px",
        textAlign:"center", boxShadow:`0 0 80px ${mod.color}40`,
        animation:"victoryPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>{"🏆"}</div>
        <div style={{ fontFamily:"'Exo 2',sans-serif", fontSize:22, fontWeight:800, color:mod.color, marginBottom:6 }}>
          {"Модуль завершено!"}
        </div>
        <div style={{ fontSize:15, color:"rgba(200,210,240,0.6)", marginBottom:16 }}>{mod.title}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:16 }}>
          {["📚 +120 XP", "⭐ +1 Рівень"].map(b => (
            <div key={b} style={{ padding:"6px 16px", background:`${mod.color}20`, border:`1px solid ${mod.color}40`, borderRadius:20, fontSize:13, color:mod.color, fontWeight:600 }}>{b}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Victory;
