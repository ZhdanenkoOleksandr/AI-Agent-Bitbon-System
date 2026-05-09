import { C } from "../data/constants";
import { MODULES } from "../data/modules";
import Ring from "./ProgressRing";

export default function ContextualSidebar({mod, tab, completedModules, onGoTo, totalProgress, completedCount}) {
  if(tab==="topics") return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <SideBlock title="Пов'язані матеріали">
        {mod.requires.map(rid=>{const rm=MODULES.find(m=>m.id===rid);return rm?(
          <div key={rid} onClick={()=>onGoTo(rid)} style={{display:"flex",gap:8,alignItems:"center",padding:"8px 10px",background:C.surf,border:`1px solid ${C.brd}`,borderRadius:8,cursor:"pointer",transition:"border-color 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=rm.color+"50"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.brd}>
            <div style={{fontSize:16}}>{rm.icon}</div>
            <div><div style={{fontSize:10,color:rm.color}}>Модуль {rm.id}</div><div style={{fontSize:12,color:C.ts}}>{rm.title}</div></div>
          </div>
        ):null;})}
        {mod.requires.length===0 && <p style={{fontSize:12,color:C.tm}}>Це вхідна точка курсу. Попередніх модулів немає.</p>}
      </SideBlock>
      <SideBlock title="Ваш прогрес">
        <div style={{textAlign:"center"}}>
          <div style={{position:"relative",display:"inline-block",margin:"4px 0 8px"}}>
            <Ring pct={totalProgress} size={80} sw={4} color={C.acc}/>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
              <span style={{fontSize:18,fontFamily:"'Exo 2',sans-serif",fontWeight:800,color:C.acc}}>{totalProgress}%</span>
            </div>
          </div>
          <div style={{fontSize:11,color:C.tm}}>{completedCount} з {MODULES.length} модулів</div>
        </div>
      </SideBlock>
    </div>
  );
  if(tab==="practice") return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <SideBlock title="Приклади виконання">
        {["Опишіть 3 права, які ви зараз довіряєте посереднику","Знайдіть аналог SSI у реальному житті","Порівняйте з традиційним паспортом"].map((ex,i)=>(
          <div key={i} style={{padding:"8px 10px",background:C.surf,border:`1px solid ${C.brd}`,borderRadius:8,fontSize:12,color:C.ts,lineHeight:1.5}}>
            <span style={{color:mod.color,fontWeight:700,marginRight:6}}>{i+1}.</span>{ex}
          </div>
        ))}
      </SideBlock>
      <SideBlock title="Критерії оцінки">
        {["Конкретність прикладу","Зв'язок з темою модуля","Власна думка, а не переказ"].map((c,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,color:C.ts,lineHeight:1.5,marginBottom:6}}>
            <span style={{color:C.teal,marginTop:1}}>&#10003;</span>{c}
          </div>
        ))}
      </SideBlock>
    </div>
  );
  if(tab==="outcome") {
    const nextMod = MODULES.find(m=>m.id===mod.id+1);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {nextMod && (
          <SideBlock title="Наступний кrok">
            <div style={{padding:12,background:`${nextMod.color}12`,border:`1px solid ${nextMod.color}30`,borderRadius:10}}>
              <div style={{fontSize:11,color:nextMod.color,marginBottom:4}}>Модуль {nextMod.id} · {nextMod.tag}</div>
              <div style={{fontSize:13,fontWeight:600,color:C.tp,marginBottom:8}}>{nextMod.title}</div>
              <button onClick={()=>onGoTo(nextMod.id)} style={{width:"100%",padding:"7px",background:nextMod.color,border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Перейти &#8594;</button>
            </div>
          </SideBlock>
        )}
        <SideBlock title="Ролі для вас">
          {[{r:"Інвестор",i:"&#128176;",c:C.gold},{r:"Бізнес",i:"&#127970;",c:C.acc},{r:"Експерт",i:"&#127891;",c:C.pur}].map(role=>(
            <div key={role.r} style={{display:"flex",gap:8,alignItems:"center",padding:"8px 10px",background:C.surf,border:`1px solid ${role.c}25`,borderRadius:8,marginBottom:6}}>
              <span style={{fontSize:18}} dangerouslySetInnerHTML={{__html:role.i}}/>
              <span style={{fontSize:12,color:role.c,fontWeight:600}}>{role.r}</span>
            </div>
          ))}
        </SideBlock>
      </div>
    );
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <SideBlock title="Ключова ідея">
        <p style={{fontSize:12,color:C.ts,lineHeight:1.7,fontStyle:"italic"}}>"{mod.keyIdea}"</p>
      </SideBlock>
      <SideBlock title="Статистика">
        {[{l:"Тривалість",v:mod.duration,i:"&#9201;"},{l:"Уроків",v:mod.lessons,i:"&#128218;"},{l:"Теми",v:mod.topics.length,i:"&#127917;"}].map(s=>(
          <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.brd}`,fontSize:12}}>
            <span style={{color:C.tm}} dangerouslySetInnerHTML={{__html:s.i+" "+s.l}}/>
            <span style={{color:C.ts,fontWeight:600}}>{s.v}</span>
          </div>
        ))}
      </SideBlock>
    </div>
  );
}

const SideBlock = ({title, children}) => (
  <div>
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",color:C.tm,fontWeight:700,marginBottom:10}}>{title}</div>
    {children}
  </div>
);
