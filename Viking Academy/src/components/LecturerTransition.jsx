import { useState, useEffect } from "react";
import { C } from "../data/constants";
import BitbonLogo from "./BitbonLogo";

export default function LecturerTransition({text,fromLabel,toLabel,accentColor,onContinue}) {
  const [visible,setVisible] = useState(false);
  const [wordIdx,setWordIdx] = useState(0);
  const words = text.split(" ");
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),30);return()=>clearTimeout(t);},[]);
  useEffect(()=>{
    if(!visible||wordIdx>=words.length) return;
    const t=setTimeout(()=>setWordIdx(i=>i+1),28);
    return()=>clearTimeout(t);
  },[visible,wordIdx,words.length]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(4,8,18,0.92)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",opacity:visible?1:0,transition:"opacity 0.4s ease"}}>
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:"15%",left:"-5%",width:"50%",height:1,background:`linear-gradient(90deg,transparent,${accentColor}30,transparent)`,transform:"rotate(-12deg)"}}/>
        <div style={{position:"absolute",bottom:"20%",right:"-5%",width:"40%",height:1,background:`linear-gradient(90deg,transparent,${accentColor}25,transparent)`,transform:"rotate(-8deg)"}}/>
      </div>
      <div style={{maxWidth:700,width:"90%",padding:"48px 52px",background:"linear-gradient(135deg,#0D1830,#0A1222)",border:`1px solid ${accentColor}35`,borderRadius:20,boxShadow:`0 0 80px ${accentColor}15,0 40px 80px rgba(0,0,0,0.6)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,width:80,height:80,background:`linear-gradient(135deg,${accentColor}18,transparent)`,borderRadius:"20px 0 60px 0"}}/>
        {fromLabel && toLabel && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:28,flexWrap:"wrap"}}>
            <span style={{fontSize:11,padding:"4px 10px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(200,210,240,0.4)"}}>{fromLabel}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{fontSize:11,padding:"4px 10px",borderRadius:10,background:`${accentColor}18`,border:`1px solid ${accentColor}40`,color:accentColor,fontWeight:600}}>{toLabel}</span>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:14,flexShrink:0,background:`linear-gradient(135deg,${accentColor}30,${accentColor}10)`,border:`1.5px solid ${accentColor}60`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 20px ${accentColor}25`}}>
            <BitbonLogo size={28} color={accentColor}/>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.tp,fontFamily:"'Exo 2',sans-serif"}}>Олександр Кудь</div>
            <div style={{fontSize:11,color:C.tm,marginTop:2}}>Ідеолог Системи Bitbon</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:accentColor,animation:"lecPulse 1.2s ease-in-out infinite"}}/>
            <span style={{fontSize:10,color:accentColor,letterSpacing:"0.1em",textTransform:"uppercase"}}>Live</span>
          </div>
        </div>
        <div style={{fontSize:52,lineHeight:0.8,color:`${accentColor}30`,fontFamily:"Georgia,serif",marginBottom:12,userSelect:"none"}}>"</div>
        <p style={{fontSize:17,lineHeight:1.75,color:"#D8E4FF",fontWeight:400,minHeight:120}}>
          {words.slice(0,wordIdx).join(" ")}
          {wordIdx<words.length && <span style={{display:"inline-block",width:2,height:18,background:accentColor,marginLeft:3,verticalAlign:"middle",animation:"blink 0.7s step-end infinite"}}/>}
        </p>
        <div style={{fontSize:52,lineHeight:0.8,color:`${accentColor}30`,fontFamily:"Georgia,serif",textAlign:"right",marginTop:8,userSelect:"none"}}>"</div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:28}}>
          <button onClick={onContinue} disabled={wordIdx<Math.min(8,words.length)}
            style={{padding:"12px 32px",background:wordIdx>=Math.min(8,words.length)?`linear-gradient(135deg,${accentColor},${accentColor}99)`:"rgba(255,255,255,0.05)",border:`1px solid ${wordIdx>=Math.min(8,words.length)?accentColor+"80":"rgba(255,255,255,0.1)"}`,borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:8,transition:"all 0.3s",boxShadow:wordIdx>=Math.min(8,words.length)?`0 4px 20px ${accentColor}35`:"none"}}>
            Продовжити <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
