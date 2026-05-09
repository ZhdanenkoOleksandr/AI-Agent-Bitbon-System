import { useState, useEffect, useCallback, useRef } from "react";
import { C, TOPIC_TIMES } from "./data/constants";
import { MODULES } from "./data/modules";
import { MODULE_TRANSITIONS, MODULE_INTROS, MODULE_OUTROS } from "./data/transitions";
import BitbonLogo from "./components/BitbonLogo";
import Ring from "./components/ProgressRing";
import GeoBg from "./components/GeoBg";
import Victory from "./components/Victory";
import SearchModal from "./components/SearchModal";
import SkillTree from "./components/SkillTree";
import LecturerTransition from "./components/LecturerTransition";
import IntroOutroModal from "./components/IntroOutroModal";
import PdfViewer from "./components/PdfViewer";
import ContextualSidebar from "./components/ContextualSidebar";
import QuizModule from "./components/QuizModule";
import { QUIZ_DATA } from "./data/quiz_data";

export default function App() {
  const [activeMod, setActiveMod] = useState(3);
  const [startedMods, setStartedMods] = useState(new Set([1,2])); // which modules user has clicked "Start"
  const [showIntro, setShowIntro] = useState(null); // {modId, type: "start" | "end"}
    const [activeTab, setActiveTab] = useState("topics");
  const [sideMode, setSideMode] = useState("full"); // "full" | "mini" | "hidden"
  const [focusMode, setFocusMode] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState({"3-0":true});
  const [completedTopics, setCompletedTopics] = useState(new Set(["1-0","1-1","1-2","1-3","2-0","2-1","2-2","2-3"]));
  const [completedMods, setCompletedMods] = useState(new Set([1,2]));
  const [animKey, setAnimKey] = useState(0);
  const [transition, setTransition] = useState(null);
  const [victory, setVictory] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [lastPos, setLastPos] = useState({modId:3, topicIdx:0});
  const [practiceMode, setPracticeMode] = useState("notes"); // "notes" | "quiz"
  const mainRef = useRef(null);

  const curMod = MODULES.find(m=>m.id===activeMod);
  const completedCount = completedMods.size;
  const totalProgress = Math.round((completedCount/MODULES.length)*100);
  const tabs = ["topics","practice","outcome","overview"];
  const tabLabels = {topics:"Теми",practice:"Практика",outcome:"Результат",overview:"Огляд"};

  // Scroll-based header collapse
  useEffect(()=>{
    const el = mainRef.current;
    if(!el) return;
    const h = ()=>setHeaderScrolled(el.scrollTop > 60);
    el.addEventListener("scroll",h);
    return()=>el.removeEventListener("scroll",h);
  },[activeMod]);

  // Search hotkey
  useEffect(()=>{
    const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setShowSearch(true);}};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);

  const showTrans = (text,from,to,color,cb) => setTransition({text,from,to,color,cb});
  const dismissTrans = () => { transition?.cb(); setTransition(null); };

  const handleModChange = (id) => {
    if(id===activeMod) return;
    // Check if module has been started
    if(!startedMods.has(id)) {
      setActiveMod(id);
      setShowIntro({modId:id, type:"start"});
      setAnimKey(k=>k+1);
      if(mainRef.current) mainRef.current.scrollTop=0;
      return;
    }
    const key = `${activeMod}-${id}`;
    const tr = MODULE_TRANSITIONS[key];
    const mod = MODULES.find(m=>m.id===id);
    const doSwitch = ()=>{
      setActiveMod(id); setActiveTab("topics"); setAnimKey(k=>k+1);
      setPracticeMode("notes");
      if(mainRef.current) mainRef.current.scrollTop=0;
    };
    tr ? showTrans(tr.text,tr.from,tr.to,mod.color,doSwitch) : doSwitch();
  };

  const handleSelectFromSearch = (modId, topicIdx) => {
    const doIt = ()=>{
      setActiveMod(modId); setActiveTab("topics");
      setExpandedTopics(prev=>{
        const mod=MODULES.find(m=>m.id===modId);
        const next={...prev};
        mod.topics.forEach((_,i)=>{next[`${modId}-${i}`]=false;});
        next[`${modId}-${topicIdx}`]=true;
        return next;
      });
      setAnimKey(k=>k+1);
    };
    if(modId!==activeMod){
      const tr=MODULE_TRANSITIONS[`${activeMod}-${modId}`];
      const mod=MODULES.find(m=>m.id===modId);
      tr ? showTrans(tr.text,tr.from,tr.to,mod.color,doIt) : doIt();
    } else doIt();
  };

  const toggleTopic = (modId, ti) => {
    const key=`${modId}-${ti}`;
    const isOpen=!!expandedTopics[key];
    if(isOpen){setExpandedTopics(p=>({...p,[key]:false}));return;}
    const tr = null;
    const mod=MODULES.find(m=>m.id===modId);
    const doOpen=()=>{
      const upd={};
      mod.topics.forEach((_,i)=>{upd[`${modId}-${i}`]=false;});
      upd[key]=true;
      setExpandedTopics(p=>({...p,...upd}));
      setLastPos({modId,topicIdx:ti});
      // mark topic as viewed
      setCompletedTopics(p=>{const n=new Set(p);n.add(key);return n;});
    };
    if(tr){
      const pt=mod.topics[ti-1],nt=mod.topics[ti];
      showTrans(tr,`Тема ${String(ti).padStart(2,"0")} · ${pt}`,`Тема ${String(ti+1).padStart(2,"0")} · ${nt}`,mod.color,doOpen);
    } else doOpen();
  };

  const markModDone = (id) => {
    setCompletedMods(p=>{const n=new Set(p);n.add(id);return n;});
    const mod=MODULES.find(m=>m.id===id);
    setVictory(mod);
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(74,158,255,0.2);border-radius:10px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeSlideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lecPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.85)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes shimmerBg{0%{background-position:0% 50%}100%{background-position:200% 50%}}
    @keyframes confettiDrop{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}
    @keyframes victoryPop{from{opacity:0;transform:translate(-50%,-50%) scale(0.7)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
    @keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.5}}
    @keyframes topicSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
    .fu{animation:fadeUp 0.4s ease forwards}
    .fu2{animation:fadeUp 0.4s 0.08s ease both}
    .shim-title{background:linear-gradient(90deg,#4A9EFF,#38BDF8,#00C8A0,#93C5FD,#60A5FA,#4A9EFF);background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmerBg 2.5s linear infinite}
    .mod-item{transition:background 0.15s,border-color 0.15s;cursor:pointer}
    .mod-item:hover{background:rgba(255,255,255,0.03)!important}
    .topic-row{transition:background 0.15s,border-color 0.15s;cursor:pointer}
    .topic-row:hover{background:rgba(74,158,255,0.05)!important}
    .cta{transition:all 0.2s}.cta:hover{transform:translateY(-2px)}
    .sc{transition:all 0.15s}.sc:hover{transform:translateY(-2px)}
    .resume-btn{transition:all 0.2s}.resume-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(74,158,255,0.3)!important}
    .focus-toggle{transition:all 0.2s}
    input::placeholder{color:rgba(160,180,220,0.35)}
    textarea::placeholder{color:rgba(160,180,220,0.3)}
  `;

  const sideWidth = sideMode==="full"?280:sideMode==="mini"?56:0;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:C.bg,color:C.tp,minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <GeoBg/>

      {transition && <LecturerTransition text={transition.text} fromLabel={transition.from} toLabel={transition.to} accentColor={transition.color} onContinue={dismissTrans}/>}
      {showIntro && <IntroOutroModal modId={showIntro.modId} type={showIntro.type} onClose={()=>{
        if(showIntro.type==="start") setStartedMods(s=>{const n=new Set(s);n.add(showIntro.modId);return n;});
        setShowIntro(null);
      }}/>}
      {victory && <Victory mod={victory} onDone={()=>setVictory(null)}/>}
      {showSearch && <SearchModal modules={MODULES} onSelect={handleSelectFromSearch} onClose={()=>setShowSearch(false)}/>}
      {showTree && <SkillTree modules={MODULES} completedModules={completedMods} activeModule={activeMod} onSelect={handleModChange} onClose={()=>setShowTree(false)}/>}

      {/* TOP NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(7,12,24,0.92)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.brd}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:56,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setSideMode(m=>m==="full"?"mini":m==="mini"?"full":"full")}
            style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:8,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}>
            {[0,1,2].map(i=><div key={i} style={{width:15,height:1.5,background:C.ts,borderRadius:1}}/>)}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <BitbonLogo size={24} color={C.acc}/>
            <div>
              <div style={{fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:14}}>Bit<span style={{color:C.acc}}>bon</span></div>
              <div style={{fontSize:7.5,color:"#fff",letterSpacing:"0.12em",textTransform:"uppercase",lineHeight:1.3}}>
                <div>Viking</div><div>Academy</div>
              </div>
            </div>
          </div>
          <div style={{width:1,height:24,background:C.brd,margin:"0 6px"}}/>
          <div className="shim-title" style={{fontSize:13,fontWeight:700,letterSpacing:"0.03em"}}>Курс трансформації у Web 4.0</div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Resume button */}
          <button className="resume-btn" onClick={()=>handleSelectFromSearch(lastPos.modId,lastPos.topicIdx)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(74,158,255,0.1)",border:`1px solid ${C.acc}35`,borderRadius:8,cursor:"pointer",color:C.acc,fontSize:11,fontWeight:600,boxShadow:"none"}}>
            <span style={{fontSize:13}}>&#9654;</span>
            <span>Продовжити</span>
          </button>

          {/* Skill tree */}
          <button onClick={()=>setShowTree(true)}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:8,cursor:"pointer",color:C.ts,fontSize:11}}>
            <span>&#9674;</span> Skill Tree
          </button>
          {/* Focus mode */}
          <button className="focus-toggle" onClick={()=>{setFocusMode(f=>!f);setSideMode(m=>focusMode?"full":"mini");}}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",background:focusMode?`${C.teal}20`:"rgba(255,255,255,0.05)",border:`1px solid ${focusMode?C.teal+"40":C.brd}`,borderRadius:8,cursor:"pointer",color:focusMode?C.teal:C.ts,fontSize:11,fontWeight:focusMode?600:400}}>
            {focusMode?"&#10006; Фокус":"&#10094;&#10095; Фокус"}
          </button>
          {/* Progress */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.brd}`,borderRadius:16}}>
            <div style={{width:80,height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${totalProgress}%`,background:`linear-gradient(90deg,${C.acc},${C.teal})`,borderRadius:2,transition:"width 0.8s ease"}}/>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:C.acc}}>{totalProgress}%</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.brd}`,borderRadius:16}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:`linear-gradient(135deg,${C.acc},${C.teal})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>У</div>
            <span style={{fontSize:12}}>Учасник</span>
          </div>
        </div>
      </nav>

      <div style={{display:"flex",flex:1,minHeight:0,position:"relative",zIndex:1}}>

        {/* SIDEBAR */}
        <aside style={{width:sideWidth,minWidth:sideWidth,overflow:"hidden",transition:"all 0.3s ease",background:"rgba(13,21,38,0.7)",backdropFilter:"blur(10px)",borderRight:`1px solid ${C.brd}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          {sideMode==="full" && (
            <>
              <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.brd}`,flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontFamily:"'Exo 2',sans-serif",fontWeight:700,fontSize:12,letterSpacing:"0.06em",textTransform:"uppercase",color:C.tm}}>Програма</div>
                  <div style={{fontSize:11,color:C.acc,background:C.accG,padding:"2px 7px",borderRadius:10}}>{completedCount}/{MODULES.length}</div>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
                {MODULES.map((mod,idx)=>{
                  const isAct=mod.id===activeMod;
                  const isDone=completedMods.has(mod.id);
                  const topicsDone=mod.topics.filter((_,ti)=>completedTopics.has(`${mod.id}-${ti}`)).length;
                  const pct=Math.round((topicsDone/mod.topics.length)*100);
                  return (
                    <div key={mod.id} className="mod-item" onClick={()=>handleModChange(mod.id)}
                      style={{padding:"9px 14px",background:isAct?`linear-gradient(90deg,${mod.color}12,transparent)`:"transparent",borderLeft:`2px solid ${isAct?mod.color:"transparent"}`,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:9,flexShrink:0,position:"relative",background:isDone?`${mod.color}22`:isAct?`${mod.color}15`:"rgba(255,255,255,0.04)",border:`1px solid ${isDone?mod.color+"50":isAct?mod.color+"40":C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                        {isDone ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={mod.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : mod.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,color:isAct?mod.color:C.tm,fontWeight:500,marginBottom:1}}>{String(idx+1).padStart(2,"0")} · {mod.tag}</div>
                        <div style={{fontSize:12,fontWeight:isAct?600:400,color:isAct?C.tp:C.ts,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mod.title}</div>
                        <div style={{marginTop:4,height:2,background:"rgba(255,255,255,0.06)",borderRadius:1,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:mod.color,borderRadius:1,transition:"width 0.6s ease"}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{padding:12,borderTop:`1px solid ${C.brd}`,flexShrink:0}}>
                <div style={{padding:12,background:C.goldG,border:`1px solid ${C.gold}30`,borderRadius:10,textAlign:"center"}}>
                  <div style={{fontSize:16,marginBottom:2}}>&#127942;</div>
                  <div style={{fontSize:11,fontWeight:600,color:C.gold}}>Сертифікат</div>
                  <div style={{fontSize:10,color:C.ts,marginTop:1}}>Пройдіть усі 10 модулів</div>
                </div>
              </div>
            </>
          )}
          {sideMode==="mini" && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0",gap:4,overflowY:"auto"}}>
              {MODULES.map((mod)=>{
                const isAct=mod.id===activeMod;
                const isDone=completedMods.has(mod.id);
                return (
                  <button key={mod.id} onClick={()=>handleModChange(mod.id)} title={mod.title}
                    style={{width:40,height:40,borderRadius:10,border:`1.5px solid ${isAct?mod.color:isDone?mod.color+"50":C.brd}`,background:isAct?`${mod.color}20`:isDone?`${mod.color}10`:"rgba(255,255,255,0.03)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,transition:"all 0.15s",boxShadow:isAct?`0 0 10px ${mod.color}40`:"none"}}>
                    {isDone?"✓":mod.icon}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main ref={mainRef} style={{flex:1,overflowY:"auto",minWidth:0,display:"flex",flexDirection:"column"}}>
          {/* MODULE HEADER */}
          <div key={animKey} style={{
            padding:headerScrolled?"10px 28px":"24px 28px 0",
            background:headerScrolled?`rgba(7,12,24,0.95)`:`linear-gradient(180deg,${curMod.glow} 0%,transparent 100%)`,
            borderBottom:`1px solid ${C.brd}`,
            flexShrink:0,
            transition:"padding 0.3s ease",
            position:"sticky",top:0,zIndex:50,
            backdropFilter:"blur(16px)",
          }}>
            {!headerScrolled && (
              <div className="fu" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 9px",borderRadius:10,background:`${curMod.color}20`,color:curMod.color,border:`1px solid ${curMod.color}40`,fontWeight:700}}>Модуль {curMod.id} · {curMod.tag}</span>
                    {completedMods.has(curMod.id) && <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,background:"rgba(0,200,160,0.2)",color:C.teal,border:"1px solid rgba(0,200,160,0.4)"}}>&#10003; Завершено</span>}
                    {curMod.id===3 && !completedMods.has(3) && <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,background:`${C.gold}20`,color:C.gold,border:`1px solid ${C.gold}40`,animation:"shimmer 2s infinite"}}>&#9679; В процесі</span>}
                  </div>
                  <h1 style={{fontFamily:"'Exo 2',sans-serif",fontSize:24,fontWeight:800,lineHeight:1.2,marginBottom:4,letterSpacing:"-0.02em"}}>{curMod.title}</h1>
                  <p style={{fontSize:14,color:C.ts,fontWeight:300,marginBottom:12}}>{curMod.subtitle}</p>
                  <div style={{display:"flex",gap:18}}>
                    {[{i:"&#9201;",l:curMod.duration},{i:"&#128218;",l:`${curMod.lessons} уроки`},{i:"&#127917;",l:curMod.topics.length+" теми"}].map((s,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.tm}}>
                        <span dangerouslySetInnerHTML={{__html:s.i}}/>
                        <span style={{color:C.ts}}>{s.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginLeft:20,position:"relative",flexShrink:0}}>
                  <Ring pct={completedMods.has(curMod.id)?100:curMod.id===3?45:0} size={64} sw={3} color={curMod.color}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{curMod.icon}</div>
                </div>
              </div>
            )}
            {headerScrolled && (
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:16}}>{curMod.icon}</span>
                <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:15,fontWeight:700,color:C.tp}}>{curMod.title}</h2>
                <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:`${curMod.color}20`,color:curMod.color}}>Модуль {curMod.id}</span>
              </div>
            )}
            <div style={{display:"flex",gap:0,marginTop:headerScrolled?8:4}}>
              {tabs.map(tab=>{
                const ia=activeTab===tab;
                return (
                  <button key={tab} onClick={()=>setActiveTab(tab)}
                    style={{background:"transparent",border:"none",cursor:"pointer",padding:"8px 16px",fontSize:12,fontWeight:ia?700:400,color:ia?curMod.color:C.tm,borderBottom:`2px solid ${ia?curMod.color:"transparent"}`,fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}>
                    {tabLabels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENT */}
          <div key={`${animKey}-${activeTab}`} className="fu" style={{padding:"24px 28px",flex:1}}>
          {/* Module not started overlay */}
          {!startedMods.has(activeMod) && (
            <div style={{position:"absolute",inset:0,background:"rgba(7,12,24,0.95)",backdropFilter:"blur(16px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:40}}>
              <div style={{textAlign:"center",maxWidth:400}}>
                <div style={{fontSize:48,marginBottom:16}}>{curMod.icon}</div>
                <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:24,fontWeight:800,color:curMod.color,marginBottom:8}}>Модуль {curMod.id}</h2>
                <p style={{fontSize:15,color:C.ts,marginBottom:24,lineHeight:1.6}}>{curMod.description}</p>
                <button onClick={()=>setShowIntro({modId:activeMod,type:"start"})}
                  style={{padding:"14px 36px",background:`linear-gradient(135deg,${curMod.color},${curMod.color}99)`,border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:`0 8px 24px ${curMod.color}40`,transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                  ▶ Почати модуль
                </button>
              </div>
            </div>
          )}


            {activeTab==="topics" && (
              <div>
                <p style={{fontSize:13,color:C.tm,marginBottom:14}}>Теми модуля — натисніть, щоб розкрити:</p>
                {curMod.topics.map((topic,i)=>{
                  const key=`${curMod.id}-${i}`;
                  const isOpen=!!expandedTopics[key];
                  const isDone=completedTopics.has(key);
                  const hasPdf=curMod.pdfSlides&&i===0;
                  const timeIdx=(curMod.id-1)*4+i;
                  const readTime=TOPIC_TIMES[timeIdx]||10;
                  return (
                    <div key={i} style={{marginBottom:8}}>
                      <div className="topic-row" onClick={()=>toggleTopic(curMod.id,i)}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",background:isOpen?`${curMod.color}10`:"#0D1526",border:`1px solid ${isOpen?curMod.color+"45":C.brd}`,borderRadius:isOpen?"12px 12px 0 0":"12px"}}>
                        {/* Number */}
                        <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:isDone?`${curMod.color}30`:`${curMod.color}20`,border:`1px solid ${isDone?curMod.color:curMod.color+"50"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:curMod.color,fontFamily:"'Exo 2',sans-serif",position:"relative"}}>
                          {isDone ? <span style={{fontSize:14}}>&#10003;</span> : String(i+1).padStart(2,"0")}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:13,lineHeight:1.5,color:C.tp,fontWeight:500,marginBottom:3}}>{topic}</p>
                          {/* Meta row */}
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:10,color:C.tm}}>&#9201; ~{readTime} хв</span>
                            {isDone && <span style={{fontSize:10,color:C.teal}}>&#10003; Переглянуто</span>}
                            {hasPdf && <span style={{fontSize:10,color:curMod.color}}>&#128196; PDF-матеріал</span>}
                            {/* Topic progress micro-bar */}
                            <div style={{flex:1,height:2,background:"rgba(255,255,255,0.06)",borderRadius:1,overflow:"hidden",maxWidth:80}}>
                              <div style={{height:"100%",width:isDone?"100%":"0%",background:curMod.color,transition:"width 0.6s ease"}}/>
                            </div>
                          </div>
                        </div>
                        <div style={{width:24,height:24,borderRadius:6,flexShrink:0,background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,display:"flex",alignItems:"center",justifyContent:"center",color:isOpen?curMod.color:C.tm,fontSize:13,transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none"}}>&#9660;</div>
                      </div>
                      {isOpen && (
                        <div style={{background:`${curMod.color}06`,border:`1px solid ${curMod.color}30`,borderTop:"none",borderRadius:"0 0 12px 12px",padding:"0 16px 14px",animation:"topicSlide 0.25s ease"}}>
                          {hasPdf ? (
                            <PdfViewer onClose={()=>toggleTopic(curMod.id,i)} accentColor={curMod.color}/>
                          ) : (
                            <div style={{paddingTop:12}}>
                              <p style={{fontSize:13,color:C.ts,lineHeight:1.7,marginBottom:10}}>Докладно розглянемо цю тему під час уроку. Ви отримаєте теоретичний матеріал, практичні приклади та завдання для самоперевірки.</p>
                              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                                {[`&#9201; ~${readTime} хв`,"&#128221; Конспект","&#9989; Тест"].map(t=>(
                                  <div key={t} style={{padding:"4px 10px",background:C.surf,border:`1px solid ${C.brd}`,borderRadius:16,fontSize:11,color:C.tm}} dangerouslySetInnerHTML={{__html:t}}/>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab==="practice" && (
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                {/* Mode switcher */}
                <div style={{display:"flex",gap:0,background:"rgba(13,21,38,0.8)",border:`1px solid ${C.brd}`,borderRadius:11,padding:4}}>
                  {[{k:"notes",l:"📝 Нотатки"},{k:"quiz",l:"🎯 Тест"}].map(({k,l})=>{
                    const ia=practiceMode===k;
                    return (
                      <button key={k} onClick={()=>setPracticeMode(k)} style={{
                        flex:1,padding:"8px 0",borderRadius:8,border:"none",cursor:"pointer",
                        background:ia?`linear-gradient(135deg,${curMod.color},${curMod.color}99)`:"transparent",
                        color:ia?"#fff":C.tm,fontSize:13,fontWeight:ia?700:400,
                        fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s",
                        boxShadow:ia?`0 2px 12px ${curMod.color}40`:"none"
                      }}>{l}</button>
                    );
                  })}
                </div>

                {practiceMode==="notes" && (
                  <>
                    <div style={{padding:20,background:C.surfH,border:`1px solid ${curMod.color}30`,borderRadius:14}}>
                      <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:17,fontWeight:700,color:curMod.color,marginBottom:6}}>Практичне завдання</h2>
                      <p style={{fontSize:14,color:C.ts,lineHeight:1.7}}>
                        Застосуйте знання з модуля до власного контексту. Запишіть 3 конкретних спостереження на тему: <strong style={{color:C.tp}}>«{curMod.subtitle}»</strong>
                      </p>
                    </div>
                    {curMod.topics.map((t,i)=>(
                      <div key={i} style={{padding:16,background:C.surf,border:`1px solid ${C.brd}`,borderRadius:12}}>
                        <h3 style={{fontSize:13,fontWeight:600,color:C.ts,marginBottom:8}}>
                          <span style={{color:curMod.color,marginRight:8}}>{String(i+1).padStart(2,"0")}.</span>{t}
                        </h3>
                        <textarea placeholder="Ваша нотатка до цієї теми..."
                          style={{width:"100%",minHeight:72,background:"rgba(0,0,0,0.2)",border:`1px solid ${C.brd}`,borderRadius:7,padding:"10px 12px",color:C.tp,fontSize:13,resize:"vertical",fontFamily:"'DM Sans',sans-serif",outline:"none",lineHeight:1.6}}/>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
                      <button className="cta" style={{padding:"10px 22px",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:9,color:C.ts,fontSize:13,cursor:"pointer"}}>Зберегти чернетку</button>
                      <button className="cta" onClick={()=>markModDone(curMod.id)}
                        style={{padding:"10px 22px",background:`linear-gradient(135deg,${curMod.color},${curMod.color}99)`,border:"none",borderRadius:9,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${curMod.color}35`,display:"flex",alignItems:"center",gap:8}}>
                        &#10003; Завершити модуль
                      </button>
                    </div>
                  </>
                )}

                {practiceMode==="quiz" && (
                  QUIZ_DATA[curMod.id] ? (
                    <QuizModule
                      quizData={QUIZ_DATA[curMod.id]}
                      accentColor={curMod.color}
                      onComplete={()=>markModDone(curMod.id)}
                    />
                  ) : (
                    <div style={{padding:32,textAlign:"center",background:C.surfH,border:`1px solid ${C.brd}`,borderRadius:14}}>
                      <div style={{fontSize:36,marginBottom:12}}>🔒</div>
                      <div style={{fontFamily:"'Exo 2',sans-serif",fontSize:16,fontWeight:700,color:C.ts,marginBottom:6}}>Тест ще готується</div>
                      <p style={{fontSize:13,color:C.tm}}>Тест для цього модуля буде доданий незабаром.</p>
                    </div>
                  )
                )}
              </div>
            )}

            {activeTab==="outcome" && (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {curMod.id === 12 ? (
                  <>
                    <div style={{padding:20,background:C.surfH,border:`1px solid ${C.gold}40`,borderRadius:14,textAlign:"center"}}>
                      <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:20,fontWeight:800,color:C.gold,marginBottom:6}}>🏁 ПІДСУМОК КУРСУ</h2>
                      <p style={{fontSize:14,color:C.ts,lineHeight:1.7}}>Виберіть свою траєкторію розвитку в екосистемі Bitbon</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {[
                        {title:"Для бізнесу",icon:"🏢",desc:"Токенізуйте свій бізнес, автоматизуйте процеси через метаконтракти, знижуйте витрати на 60-70%. Інтеграція One Space займає дні, а не місяці.",color:C.acc,items:["Створити метаресурс через No-code конструктор","Налаштувати eDAC для прийому платежів","Запустити перший метаконтракт з клієнтом"]},
                        {title:"Для експерта",icon:"🎓",desc:"Станьте Валідатором, Інтегратором або Регіональним оператором. Ваша експертиза і репутація стають капіталом через систему Aura.",color:C.pur,items:["Пройти сертифікацію Валідатора","Зареєструватись як Інтегратор у своїй галузі","Подати заявку на роль Регіонального оператора"]},
                        {title:"Для інвестора",icon:"💰",desc:"Сформуйте портфель Bitbon з розумінням математики дефіциту та зростання. Не спекуляція — стратегічна інвестиція в інфраструктуру Web 4.0.",color:C.gold,items:["Придбати перші одиниці Bitbon через One Space","Відстежувати метрики екосистеми (транзакції, оператори)","Диверсифікувати: Bitbon + метаактиви токенізованих бізнесів"]},
                      ].map((path,i)=>(
                        <div key={i} style={{padding:18,background:`${path.color}08`,border:`1px solid ${path.color}30`,borderRadius:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                            <span style={{fontSize:28}}>{path.icon}</span>
                            <h3 style={{fontFamily:"'Exo 2',sans-serif",fontSize:16,fontWeight:700,color:path.color}}>{path.title}</h3>
                          </div>
                          <p style={{fontSize:13,color:C.ts,lineHeight:1.6,marginBottom:12}}>{path.desc}</p>
                          <div style={{fontSize:12,color:C.tm,fontWeight:600,marginBottom:6}}>Перші кроки:</div>
                          {path.items.map((item,j)=>(
                            <div key={j} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,color:C.ts,lineHeight:1.5,marginBottom:4}}>
                              <span style={{color:path.color,marginTop:2}}>▸</span>{item}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:8,padding:20,background:"linear-gradient(135deg,#0D1830,#0A1222)",border:`2px solid ${C.gold}50`,borderRadius:14,textAlign:"center"}}>
                      <div style={{fontSize:16,marginBottom:8}}>🎉</div>
                      <div style={{fontFamily:"'Exo 2',sans-serif",fontSize:18,fontWeight:800,color:C.gold,marginBottom:6}}>Вітаємо з завершенням курсу!</div>
                      <p style={{fontSize:13,color:C.ts,marginBottom:16}}>Ви пройшли шлях від Web 2.0 до Web 4.0. Тепер час діяти.</p>
                      <button onClick={()=>markModDone(12)}
                        style={{padding:"12px 32px",background:`linear-gradient(135deg,${C.gold},${C.gold}99)`,border:"none",borderRadius:10,color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:`0 6px 24px ${C.gold}40`}}>
                        ✓ Завершити курс
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{padding:20,background:C.surfH,border:`1px solid ${C.teal}30`,borderRadius:14}}>
                      <h2 style={{fontFamily:"'Exo 2',sans-serif",fontSize:17,fontWeight:700,color:C.teal,marginBottom:8}}>🎯 Що ви зможете зробити</h2>
                      <p style={{fontSize:14,lineHeight:1.7,color:C.tp}}>{curMod.outcome}</p>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
                      {[{r:"Інвестор",i:"💰",d:"Управляти портфелем Bitbon",c:C.gold},{r:"Бізнес",i:"🏢",d:"Інтегрувати підприємство",c:C.acc},{r:"Експерт",i:"🎓",d:"Стати Валідатором або Оператором",c:C.pur}].map(r=>(
                        <div key={r.r} style={{padding:16,background:C.surf,border:`1px solid ${r.c}25`,borderRadius:12,textAlign:"center"}}>
                          <div style={{fontSize:26,marginBottom:6}} dangerouslySetInnerHTML={{__html:r.i}}/>
                          <div style={{fontSize:12,fontWeight:700,color:r.c,marginBottom:4}}>{r.r}</div>
                          <p style={{fontSize:11,color:C.ts,lineHeight:1.5}}>{r.d}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button className="cta" onClick={()=>markModDone(curMod.id)}
                        style={{flex:1,padding:"12px",background:`linear-gradient(135deg,${curMod.color},${curMod.color}99)`,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:`0 4px 20px ${curMod.color}30`}}>
                        {completedMods.has(curMod.id)?"✓ Пройдено":"▶ Завершити модуль"}
                      </button>
                      {activeMod<12 && <button className="cta" onClick={()=>handleModChange(activeMod+1)} style={{padding:"12px 22px",background:"rgba(255,255,255,0.05)",border:`1px solid ${C.brd}`,borderRadius:10,color:C.ts,fontSize:13,fontWeight:600,cursor:"pointer"}}>Далі →</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab==="overview" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <div style={{gridColumn:"1/-1",padding:20,background:C.surfH,border:`1px solid ${curMod.color}30`,borderRadius:14,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",right:-20,top:-20,width:100,height:100,background:`${curMod.color}08`,borderRadius:"50%"}}/>
                  <h2 style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:curMod.color,fontWeight:700,marginBottom:10}}>&#128161; Ключова ідея</h2>
                  <p style={{fontSize:16,lineHeight:1.65,fontWeight:500,fontStyle:"italic",color:C.tp}}>"{curMod.keyIdea}"</p>
                </div>
                <div style={{padding:18,background:C.surf,border:`1px solid ${C.brd}`,borderRadius:12}}>
                  <h2 style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:C.tm,fontWeight:700,marginBottom:10}}>Мета модуля</h2>
                  <p style={{fontSize:13,color:C.ts,lineHeight:1.7}}>{curMod.description}</p>
                </div>
                <div style={{padding:18,background:C.surf,border:`1px solid ${C.brd}`,borderRadius:12}}>
                  <h2 style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.1em",color:C.tm,fontWeight:700,marginBottom:14}}>Прогрес</h2>
                  <div style={{display:"flex",gap:14,justifyContent:"space-around"}}>
                    {[{l:"Пройдено",v:completedCount,c:C.teal},{l:"В процесі",v:1,c:C.gold},{l:"Очікує",v:MODULES.length-completedCount-1,c:C.tm}].map(s=>(
                      <div key={s.l} style={{textAlign:"center"}}>
                        <div style={{fontSize:24,fontFamily:"'Exo 2',sans-serif",fontWeight:800,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:10,color:C.tm,marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>

        {/* RIGHT CONTEXTUAL SIDEBAR */}
        {!focusMode && (
          <aside style={{width:230,flexShrink:0,background:"rgba(13,21,38,0.5)",backdropFilter:"blur(10px)",borderLeft:`1px solid ${C.brd}`,padding:16,display:"flex",flexDirection:"column",gap:16,overflowY:"auto"}}>
            <ContextualSidebar mod={curMod} tab={activeTab} completedModules={completedMods} onGoTo={handleModChange} totalProgress={totalProgress} completedCount={completedCount}/>
          </aside>
        )}

      </div>
    </div>
  );
}

