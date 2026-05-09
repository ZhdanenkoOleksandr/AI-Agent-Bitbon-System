import { useState, useEffect, useCallback } from "react";
import { C } from "../data/constants";
import { PDF_SLIDES } from "../data/slides";

export default function PdfViewer({onClose,accentColor}) {
  const [cur,setCur] = useState(0);
  const [zoom,setZoom] = useState(1);
  const [grid,setGrid] = useState(false);
  const [full,setFull] = useState(false);
  const [jumpVal,setJumpVal] = useState("");
  const [notes,setNotes] = useState({});
  const [showNote,setShowNote] = useState(false);
  const total = PDF_SLIDES.length;
  const prev = useCallback(()=>setCur(c=>(c-1+total)%total),[total]);
  const next = useCallback(()=>setCur(c=>(c+1)%total),[total]);

  useEffect(()=>{
    const h=e=>{
      if(e.key==="ArrowRight") next();
      if(e.key==="ArrowLeft") prev();
      if(e.key==="Escape"){if(full)setFull(false);else onClose();}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[next,prev,full,onClose]);

  const jumpTo = () => {
    const n = parseInt(jumpVal,10);
    if(n>=1&&n<=total){setCur(n-1);setJumpVal("");}
  };

  const SlideContent = ({inFull}) => (
    <>
      {grid ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:16,overflowY:"auto",flex:1,background:"#050810"}}>
          {PDF_SLIDES.map((sl,i)=>(
            <div key={i} onClick={()=>{setCur(i);setGrid(false);}} style={{borderRadius:6,border:`2px solid ${i===cur?accentColor:"rgba(255,255,255,0.1)"}`,overflow:"hidden",cursor:"pointer",aspectRatio:"16/9",position:"relative",boxShadow:i===cur?`0 0 12px ${accentColor}60`:"none",transition:"all 0.15s"}}>
              <img src={sl} alt={String(i+1)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",bottom:4,right:6,fontSize:10,color:"rgba(255,255,255,0.7)",fontWeight:700,background:"rgba(0,0,0,0.6)",padding:"1px 5px",borderRadius:4}}>{i+1}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",background:"#050810",overflow:"hidden"}}>
          <img src={PDF_SLIDES[cur]} alt="Slide"
            style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",transform:`scale(${zoom})`,transformOrigin:"center",transition:"transform 0.2s ease"}}/>
          {[{s:"left",a:prev,t:"‹"},{s:"right",a:next,t:"›"}].map(b=>(
            <button key={b.s} onClick={b.a} style={{position:"absolute",top:"50%",[b.s]:20,transform:"translateY(-50%)",width:48,height:48,borderRadius:"50%",background:"rgba(7,12,24,0.85)",border:`1px solid ${accentColor}50`,color:accentColor,fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)",transition:"all 0.15s"}}>{b.t}</button>
          ))}
          <div style={{position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",background:"rgba(7,12,24,0.85)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:"4px 14px",fontSize:12,color:C.ts,display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:accentColor,fontWeight:700}}>{cur+1}</span> / {total}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:6,padding:"8px 14px",overflowX:"auto",background:"rgba(7,12,24,0.95)",borderTop:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        {PDF_SLIDES.map((sl,i)=>(
          <button key={i} onClick={()=>{setCur(i);setGrid(false);}} style={{flexShrink:0,width:72,height:40,borderRadius:4,border:`2px solid ${i===cur?accentColor:"rgba(255,255,255,0.1)"}`,overflow:"hidden",cursor:"pointer",padding:0,background:"transparent",opacity:i===cur?1:0.45,transition:"all 0.15s",boxShadow:i===cur?`0 0 8px ${accentColor}60`:"none"}}>
            <img src={sl} alt={String(i+1)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </button>
        ))}
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.05)",flexShrink:0}}>
        <div style={{height:"100%",width:`${((cur+1)/total)*100}%`,background:`linear-gradient(90deg,${accentColor},${C.teal})`,transition:"width 0.3s ease"}}/>
      </div>
    </>
  );

  return (
    <>
      {full && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"#000",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 18px",background:"rgba(7,12,24,0.97)",borderBottom:`1px solid ${accentColor}30`,flexShrink:0,gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
              <span style={{fontSize:12,fontWeight:600,color:accentColor,flexShrink:0}}>Чому важно володіти одиницями Bitbon</span>
              <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                <button onClick={()=>setZoom(z=>Math.max(0.5,z-0.25))} style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,0.07)",border:`1px solid ${C.brd}`,color:C.ts,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>-</button>
                <span style={{fontSize:11,color:C.ts,minWidth:36,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>Math.min(3,z+0.25))} style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,0.07)",border:`1px solid ${C.brd}`,color:C.ts,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                <button onClick={()=>setZoom(1)} style={{fontSize:10,padding:"4px 8px",borderRadius:6,background:"rgba(255,255,255,0.07)",border:`1px solid ${C.brd}`,color:C.tm,cursor:"pointer"}}>100%</button>
                <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",background:"rgba(255,255,255,0.07)",border:`1px solid ${C.brd}`,borderRadius:6}}>
                  <input value={jumpVal} onChange={e=>setJumpVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")jumpTo();}}
                    placeholder="№" style={{width:32,background:"transparent",border:"none",outline:"none",color:C.ts,fontSize:11,textAlign:"center",fontFamily:"'DM Sans',sans-serif"}}/>
                  <span style={{fontSize:10,color:C.tm}}>/ {total}</span>
                </div>
                <button onClick={()=>setGrid(g=>!g)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,background:grid?`${accentColor}25`:"rgba(255,255,255,0.07)",border:`1px solid ${grid?accentColor+"40":C.brd}`,color:grid?accentColor:C.ts,cursor:"pointer"}}>⊞ Сітка</button>
                <button onClick={()=>setShowNote(n=>!n)} style={{fontSize:11,padding:"4px 10px",borderRadius:6,background:showNote?`${C.gold}25`:"rgba(255,255,255,0.07)",border:`1px solid ${showNote?C.gold+"40":C.brd}`,color:showNote?C.gold:C.ts,cursor:"pointer"}}>📝 Нотатка</button>
              </div>
            </div>
            <button onClick={()=>setFull(false)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 16px",background:`${accentColor}20`,border:`1px solid ${accentColor}50`,borderRadius:8,color:accentColor,fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
              <span style={{fontSize:15}}>&#8861;</span> Згорнути
            </button>
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <SlideContent inFull={true}/>
          </div>
          {showNote && (
            <div style={{padding:"10px 18px",background:"rgba(7,12,24,0.97)",borderTop:`1px solid ${C.gold}30`,flexShrink:0}}>
              <div style={{fontSize:11,color:C.gold,marginBottom:6}}>Нотатка до слайду {cur+1}:</div>
              <textarea value={notes[cur]||""} onChange={e=>setNotes(n=>({...n,[cur]:e.target.value}))}
                placeholder="Запишіть свою думку..."
                style={{width:"100%",height:60,background:"rgba(0,0,0,0.2)",border:`1px solid ${C.gold}30`,borderRadius:7,padding:"8px 10px",color:C.tp,fontSize:12,resize:"none",fontFamily:"'DM Sans',sans-serif",outline:"none",lineHeight:1.5}}/>
            </div>
          )}
        </div>
      )}
      <div style={{marginTop:14,background:"#050912",border:`1px solid ${accentColor}40`,borderRadius:14,overflow:"hidden",animation:"fadeSlideDown 0.3s ease forwards"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:26,height:26,borderRadius:6,background:`${accentColor}20`,border:`1px solid ${accentColor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>&#128196;</div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:accentColor}}>Чому важно володіти одиницями Bitbon</div>
              <div style={{fontSize:10,color:C.tm}}>{total} слайдів</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setFull(true)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",background:`${accentColor}15`,border:`1px solid ${accentColor}35`,borderRadius:7,cursor:"pointer",color:accentColor,fontSize:12,fontWeight:600}}>
              <span style={{fontSize:13}}>&#8862;</span> Розгорнути
            </button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:6,width:28,height:28,cursor:"pointer",color:C.tm,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>&#10005;</button>
          </div>
        </div>
        <div style={{position:"relative",width:"100%",background:"#000",maxHeight:380,overflow:"hidden"}}>
          <img src={PDF_SLIDES[cur]} alt="Slide" style={{width:"100%",objectFit:"contain",display:"block"}}/>
          {[{s:"left",a:prev,t:"‹"},{s:"right",a:next,t:"›"}].map(b=>(
            <button key={b.s} onClick={b.a} style={{position:"absolute",top:"50%",[b.s]:10,transform:"translateY(-50%)",width:36,height:36,borderRadius:"50%",background:"rgba(7,12,24,0.8)",border:`1px solid ${accentColor}40`,color:accentColor,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>{b.t}</button>
          ))}
          <div style={{position:"absolute",bottom:10,right:10,background:"rgba(7,12,24,0.85)",borderRadius:16,padding:"3px 10px",fontSize:11,color:C.ts}}>
            <span style={{color:accentColor,fontWeight:700}}>{cur+1}</span> / {total}
          </div>
        </div>
        <div style={{display:"flex",gap:5,padding:"8px 12px",overflowX:"auto",background:"rgba(0,0,0,0.3)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          {PDF_SLIDES.map((sl,i)=>(
            <button key={i} onClick={()=>setCur(i)} style={{flexShrink:0,width:68,height:38,borderRadius:4,border:`2px solid ${i===cur?accentColor:"rgba(255,255,255,0.08)"}`,overflow:"hidden",cursor:"pointer",padding:0,background:"transparent",opacity:i===cur?1:0.5,transition:"all 0.15s"}}>
              <img src={sl} alt={String(i+1)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            </button>
          ))}
        </div>
        <div style={{height:2,background:"rgba(255,255,255,0.05)"}}>
          <div style={{height:"100%",width:`${((cur+1)/total)*100}%`,background:`linear-gradient(90deg,${accentColor},${C.teal})`,transition:"width 0.3s ease"}}/>
        </div>
      </div>
    </>
  );
}
