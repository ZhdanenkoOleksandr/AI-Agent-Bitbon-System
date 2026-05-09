import { useState, useEffect, useRef } from "react";
import { C } from "../data/constants";

export default function SearchModal({modules, onSelect, onClose}) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = e => { if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", h);
    return ()=>window.removeEventListener("keydown", h);
  }, [onClose]);

  const results = q.length > 1 ? modules.flatMap(mod =>
    mod.topics.filter(t => t.toLowerCase().includes(q.toLowerCase())).map((t,ti) => ({mod, topicIdx:ti, topic:t}))
  ) : [];

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(4,8,18,0.88)",backdropFilter:"blur(16px)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80}}>
      <div style={{width:620,background:C.surfH,border:`1px solid ${C.brHov}`,borderRadius:16,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",borderBottom:`1px solid ${C.brd}`}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke={C.acc} strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke={C.acc} strokeWidth="2" strokeLinecap="round"/></svg>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
            placeholder="Пошук по всьому курсу..."
            style={{flex:1,background:"transparent",border:"none",outline:"none",fontSize:16,color:C.tp,fontFamily:"'DM Sans',sans-serif"}}/>
          <div style={{fontSize:11,padding:"3px 8px",background:C.surf,borderRadius:6,color:C.tm}}>ESC</div>
        </div>
        <div style={{maxHeight:380,overflowY:"auto"}}>
          {q.length < 2 ? (
            <div style={{padding:32,textAlign:"center",color:C.tm,fontSize:14}}>Введіть мінімум 2 символи для пошуку</div>
          ) : results.length === 0 ? (
            <div style={{padding:32,textAlign:"center",color:C.tm,fontSize:14}}>Нічого не знайдено за запитом «{q}»</div>
          ) : results.map((r,i) => (
            <div key={i} onClick={() => { onSelect(r.mod.id, r.topicIdx); onClose(); }}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",cursor:"pointer",borderBottom:`1px solid ${C.brd}`,transition:"background 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=`${r.mod.color}10`}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:32,height:32,borderRadius:8,background:`${r.mod.color}20`,border:`1px solid ${r.mod.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{r.mod.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:r.mod.color,marginBottom:2,fontWeight:600}}>{r.mod.tag} · Тема {String(r.topicIdx+1).padStart(2,"0")}</div>
                <div style={{fontSize:13,color:C.tp,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.topic}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={C.tm} strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          ))}
        </div>
        {results.length > 0 && (
          <div style={{padding:"10px 20px",borderTop:`1px solid ${C.brd}`,fontSize:11,color:C.tm}}>
            Знайдено {results.length} результат{results.length === 1 ? "" : results.length < 5 ? "и" : "ів"}
          </div>
        )}
      </div>
    </div>
  );
}
