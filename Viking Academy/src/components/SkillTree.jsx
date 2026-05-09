import { C } from "../data/constants";

export default function SkillTree({modules, completedModules, activeModule, onSelect, onClose}) {
  const pos = [
    {id:1,x:400,y:60},
    {id:2,x:250,y:160},{id:3,x:550,y:160},
    {id:4,x:250,y:280},{id:5,x:550,y:280},
    {id:6,x:350,y:400},{id:7,x:550,y:400},
    {id:8,x:450,y:510},
    {id:9,x:350,y:620},
    {id:10,x:450,y:730},
  ];
  const edges = [{f:1,t:2},{f:1,t:3},{f:2,t:4},{f:3,t:4},{f:3,t:5},{f:4,t:5},{f:5,t:6},{f:5,t:7},{f:6,t:8},{f:7,t:8},{f:8,t:9},{f:8,t:10},{f:9,t:10}];

  return (
    <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(4,8,18,0.92)",backdropFilter:"blur(16px)",display:"flex",flexDirection:"column",alignItems:"center",overflow:"auto"}} onClick={onClose}>
      <div style={{width:800,maxWidth:"95vw",padding:"40px 20px"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <div>
            <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:22,fontWeight:800,color:C.tp}}>Карта навичок</h2>
            <p style={{fontSize:13,color:C.tm,marginTop:4}}>Пройдіть модулі у правильному порядку для розблокування наступних</p>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:8,width:36,height:36,cursor:"pointer",color:C.tm,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <svg width="800" height="820" style={{display:"block",margin:"0 auto",maxWidth:"100%"}}>
          {edges.map((e,i) => {
            const from = pos.find(p=>p.id===e.f), to = pos.find(p=>p.id===e.t);
            const fMod = modules.find(m=>m.id===e.f);
            const active = completedModules.has(e.f);
            return (
              <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={active ? fMod.color+"80" : "rgba(255,255,255,0.08)"}
                strokeWidth={active?2:1} strokeDasharray={active?"none":"6,4"}/>
            );
          })}
          {pos.map(p => {
            const mod = modules.find(m=>m.id===p.id);
            const isDone = completedModules.has(p.id);
            const isAct = activeModule===p.id;
            const locked = !isDone && !isAct && mod.requires.some(r=>!completedModules.has(r));
            return (
              <g key={p.id} onClick={()=>{if(!locked){onSelect(p.id);onClose();}}} style={{cursor:locked?"not-allowed":"pointer"}}>
                <circle cx={p.x} cy={p.y} r={isDone?28:isAct?32:24}
                  fill={isDone?mod.color+"30":isAct?mod.color+"20":"rgba(255,255,255,0.04)"}
                  stroke={isDone?mod.color:isAct?mod.color:"rgba(255,255,255,0.15)"}
                  strokeWidth={isAct?2.5:1.5}
                  filter={isAct?`drop-shadow(0 0 12px ${mod.color})`:"none"}/>
                {locked && <text x={p.x} y={p.y+5} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="16">🔒</text>}
                {!locked && <text x={p.x} y={p.y+6} textAnchor="middle" fontSize="18">{isDone?"✓":mod.icon}</text>}
                <text x={p.x} y={p.y+48} textAnchor="middle" fill={locked?C.tm:isAct?mod.color:C.ts} fontSize="11" fontWeight={isAct?"700":"400"}>{mod.tag}</text>
                {isDone && <circle cx={p.x+20} cy={p.y-20} r={8} fill={mod.color}/>}
                {isDone && <text x={p.x+20} y={p.y-16} textAnchor="middle" fontSize="9" fill="#000">✓</text>}
              </g>
            );
          })}
        </svg>
        <div style={{display:"flex",justifyContent:"center",gap:24,marginTop:16}}>
          {[{l:"Пройдено",c:C.teal,sym:"●"},{l:"Активний",c:C.gold,sym:"◉"},{l:"Очікує",c:C.ts,sym:"○"},{l:"Заблоковано",c:C.tm,sym:"🔒"}].map(i=>(
            <div key={i.l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.tm}}>
              <span style={{color:i.c}}>{i.sym}</span>{i.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
