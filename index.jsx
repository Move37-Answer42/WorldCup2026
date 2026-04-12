import { useState, useEffect, useCallback } from "react";

const TOTAL_BUDGET = 200;
const CATEGORIES = ["Outright Winner", "Long Shot", "Group Stage", "Parlay"];
const PLATFORMS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "PointsBet", "Other"];
const STATUSES = ["Pending", "Placed", "Won", "Lost", "Cashed Out"];
const STATUS_COLORS = { Pending: "#f59e0b", Placed: "#3b82f6", Won: "#10b981", Lost: "#ef4444", "Cashed Out": "#8b5cf6" };
const CATEGORY_ICONS = { "Outright Winner": "🏆", "Long Shot": "🚀", "Group Stage": "⚽", "Parlay": "🔗" };
const RISK_COLORS = { Low: "#10b981", Medium: "#f59e0b", High: "#ef4444", Degen: "#8b5cf6" };

const STORAGE_KEY = "wc2026-bets-v2";
const META_KEY    = "wc2026-meta-v2";
const NAME_KEY    = "wc2026-username";

const INITIAL_BETS = [
  { id:1, category:"Outright Winner", team:"Spain",    description:"To win the World Cup", odds:"+550",  stake:15, platform:"DraftKings", status:"Pending", note:"Reigning Euro champs, #1 ranked" },
  { id:2, category:"Outright Winner", team:"England",  description:"To win the World Cup", odds:"+700",  stake:20, platform:"FanDuel",    status:"Pending", note:"Under Tuchel — finally their year?" },
  { id:3, category:"Outright Winner", team:"Brazil",   description:"To win the World Cup", odds:"+800",  stake:15, platform:"DraftKings", status:"Pending", note:"Best South American value" },
  { id:4, category:"Long Shot",       team:"Norway",   description:"To win the World Cup", odds:"+2200", stake:10, platform:"BetMGM",     status:"Pending", note:"Haaland + Odegaard — went 8-0 in qualifying" },
  { id:5, category:"Long Shot",       team:"Colombia", description:"To win the World Cup", odds:"+4000", stake:10, platform:"BetMGM",     status:"Pending", note:"Luis Díaz on fire at Bayern" },
  { id:6, category:"Long Shot",       team:"Ecuador",  description:"To win the World Cup", odds:"+6600", stake:10, platform:"BetMGM",     status:"Pending", note:"Pure lottery — conceded 5 goals all qualifying" },
  { id:7, category:"Long Shot",       team:"Portugal", description:"To win the World Cup", odds:"+1400", stake:10, platform:"FanDuel",    status:"Pending", note:"Value at this price" },
];

const BASE_PARLAYS = [
  {
    id:1, name:"The European Lock", riskLevel:"Low",
    legs:["Spain to win Group B", "England to win their group", "France to advance from group stage"],
    estimatedOdds:"+420", suggestedStake:15,
    rationale:"Three elite European sides all heavily favored to advance. Lower variance, clean value on chalk."
  },
  {
    id:2, name:"Haaland's Rampage", riskLevel:"Medium",
    legs:["Norway to reach Round of 16", "Erling Haaland anytime scorer (Group Stage)", "Norway to win their group"],
    estimatedOdds:"+900", suggestedStake:10,
    rationale:"Norway went 8-0 in qualifying. If Haaland fires early, they could shock the group and create real momentum."
  },
  {
    id:3, name:"South American Chaos", riskLevel:"High",
    legs:["Argentina eliminated before QF", "Colombia to reach QF", "Brazil to top their group"],
    estimatedOdds:"+1800", suggestedStake:8,
    rationale:"Argentina's defense has cracks and Messi is 38. Colombia with Díaz is a nightmare matchup for anyone."
  },
  {
    id:4, name:"The Dark Horse Triple", riskLevel:"Degen",
    legs:["Norway to reach QF", "Ecuador to reach Round of 16", "Colombia to beat a top-8 nation"],
    estimatedOdds:"+3500", suggestedStake:5,
    rationale:"Pure chaos parlay — three well-organized sides nobody wants to face. All have real tournament pedigree."
  },
  {
    id:5, name:"Golden Boot Special", riskLevel:"High",
    legs:["Lamine Yamal top 3 scorer", "Spain to win the tournament", "Spain vs England Final"],
    estimatedOdds:"+2200", suggestedStake:7,
    rationale:"Spain vs England final is realistic given both are top-2 favorites. Yamal at 18 could be the breakout star of the tournament."
  },
];

function calcPayout(stake, odds) {
  const o = parseInt(odds);
  if (isNaN(o) || !stake) return 0;
  return o > 0 ? +(stake * (o / 100)).toFixed(2) : +(stake * (100 / Math.abs(o))).toFixed(2);
}

let localNextId = 8;

export default function App() {
  const [bets, setBets]               = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastEditor, setLastEditor]   = useState(null);
  const [userName, setUserName]       = useState("");
  const [nameInput, setNameInput]     = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [editingBet, setEditingBet]     = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab]       = useState("bets");
  const [aiQuery, setAiQuery]     = useState("");
  const [aiResults, setAiResults] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [parlays, setParlays]         = useState(BASE_PARLAYS);
  const [parlayLoading, setParlayLoading] = useState(false);
  const [parlayStatus, setParlayStatus]   = useState("base"); // "base" | "live" | "error"
  const [form, setForm] = useState({ category:"Outright Winner", team:"", description:"", odds:"", stake:"", platform:"DraftKings", status:"Pending", note:"" });

  // ── load shared storage ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const n = await window.storage.get(NAME_KEY);
        if (n?.value) setUserName(n.value);
        else setShowNameModal(true);
      } catch { setShowNameModal(true); }

      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res?.value) {
          const parsed = JSON.parse(res.value);
          setBets(parsed);
          localNextId = Math.max(...parsed.map(b => b.id), 7) + 1;
        } else {
          setBets(INITIAL_BETS);
          await window.storage.set(STORAGE_KEY, JSON.stringify(INITIAL_BETS), true);
        }
      } catch { setBets(INITIAL_BETS); }

      try {
        const m = await window.storage.get(META_KEY, true);
        if (m?.value) { const meta = JSON.parse(m.value); setLastUpdated(meta.at); setLastEditor(meta.by); }
      } catch {}

      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (newBets) => {
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newBets), true);
      const now = new Date().toISOString();
      await window.storage.set(META_KEY, JSON.stringify({ at: now, by: userName || "Someone" }), true);
      setLastUpdated(now);
      setLastEditor(userName || "Someone");
    } catch {}
  }, [userName]);

  const updateBets = useCallback((newBets) => { setBets(newBets); persist(newBets); }, [persist]);

  // ── 30s sync poll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(async () => {
      try {
        const m = await window.storage.get(META_KEY, true);
        if (m?.value) {
          const meta = JSON.parse(m.value);
          if (meta.at !== lastUpdated) {
            const res = await window.storage.get(STORAGE_KEY, true);
            if (res?.value) { setBets(JSON.parse(res.value)); setLastUpdated(meta.at); setLastEditor(meta.by); }
          }
        }
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  }, [loaded, lastUpdated]);

  function saveName() {
    if (!nameInput.trim()) return;
    setUserName(nameInput.trim());
    window.storage.set(NAME_KEY, nameInput.trim()).catch(() => {});
    setShowNameModal(false);
  }

  // ── bet CRUD ────────────────────────────────────────────────────────────
  function openAdd() { setForm({ category:"Outright Winner", team:"", description:"", odds:"", stake:"", platform:"DraftKings", status:"Pending", note:"" }); setEditingBet(null); setShowForm(true); }
  function openEdit(bet) { setForm({ ...bet }); setEditingBet(bet.id); setShowForm(true); }
  function saveBet() {
    if (!form.team || !form.odds || !form.stake) return;
    const next = editingBet
      ? bets.map(b => b.id === editingBet ? { ...form, id: editingBet } : b)
      : [...bets, { ...form, id: localNextId++ }];
    updateBets(next); setShowForm(false);
  }
  function deleteBet(id) { updateBets(bets.filter(b => b.id !== id)); }
  function updateStatus(id, status) { updateBets(bets.map(b => b.id === id ? { ...b, status } : b)); }
  function addParlayAsBet(p) {
    const next = [...bets, { id: localNextId++, category:"Parlay", team: p.name, description: p.legs.join(" + "), odds: p.estimatedOdds, stake: p.suggestedStake, platform:"DraftKings", status:"Pending", note: p.rationale }];
    updateBets(next); setActiveTab("bets"); setActiveCategory("Parlay");
  }

  // ── AI odds search ──────────────────────────────────────────────────────
  async function searchOdds() {
    if (!aiQuery.trim()) return;
    setAiLoading(true); setAiResults("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          tools:[{ type:"web_search_20250305", name:"web_search" }],
          system:"Sports betting assistant for the 2026 FIFA World Cup. Search for current odds and return a concise bullet-point summary in American format. Max 150 words.",
          messages:[{ role:"user", content:`Current 2026 World Cup odds: ${aiQuery}` }]
        })
      });
      const data = await res.json();
      setAiResults(data.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "No results found.");
    } catch { setAiResults("Search failed — check your connection and try again."); }
    setAiLoading(false);
  }

  // ── Live parlay refresh (optional) ──────────────────────────────────────
  async function refreshParlaysLive() {
    setParlayLoading(true); setParlayStatus("base");
    try {
      // Step 1: get context via web search
      const s1 = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          tools:[{ type:"web_search_20250305", name:"web_search" }],
          system:"Briefly summarize the 2026 World Cup group draw and top 8 outright winner odds in plain text. No formatting.",
          messages:[{ role:"user", content:"2026 World Cup group draw results and outright winner odds top 10" }]
        })
      });
      const d1 = await s1.json();
      const ctx = d1.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "";

      // Step 2: generate JSON parlays using context (no tools, pure text)
      const s2 = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1200,
          system:"You output ONLY a raw JSON array. No markdown. No explanation. No code fences. Start your response with [ and end with ].",
          messages:[{
            role:"user",
            content:`World Cup 2026 context: ${ctx}\n\nOutput a JSON array of 5 parlay suggestions. Each: {"id":number,"name":string,"legs":["string"],"estimatedOdds":"string","suggestedStake":number,"rationale":"string","riskLevel":"Low"|"Medium"|"High"|"Degen"}. Stakes $5-$20. Range from Low to Degen risk. Start with [ immediately.`
          }]
        })
      });
      const d2 = await s2.json();
      const raw = d2.content?.filter(c => c.type === "text").map(c => c.text).join("") || "";
      const s = raw.indexOf("["), e = raw.lastIndexOf("]");
      if (s === -1 || e <= s) throw new Error("no array");
      const parsed = JSON.parse(raw.slice(s, e + 1));
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      setParlays(parsed);
      setParlayStatus("live");
    } catch {
      setParlays(BASE_PARLAYS);
      setParlayStatus("error");
    }
    setParlayLoading(false);
  }

  // ── derived ─────────────────────────────────────────────────────────────
  const totalStaked    = bets.reduce((s,b) => s + (parseFloat(b.stake)||0), 0);
  const remaining      = TOTAL_BUDGET - totalStaked;
  const totalPotential = bets.reduce((s,b) => s + calcPayout(parseFloat(b.stake), b.odds), 0);
  const won  = bets.filter(b=>b.status==="Won").reduce((s,b)  => s + calcPayout(parseFloat(b.stake), b.odds) + parseFloat(b.stake), 0);
  const lost = bets.filter(b=>b.status==="Lost").reduce((s,b) => s + parseFloat(b.stake), 0);
  const filtered = activeCategory === "All" ? bets : bets.filter(b => b.category === activeCategory);

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:"#0a0f0d", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#2d7a45", fontFamily:"monospace", fontSize:11, letterSpacing:4 }}>LOADING SHARED SHEET...</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f0d", color:"#e8f5e9", fontFamily:"'DM Mono','Courier New',monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1e4d2b;border-radius:2px}
        .card{transition:all .2s;border:1px solid #1a2e1f}
        .card:hover{border-color:#2d7a45;transform:translateY(-1px)}
        .btn{transition:opacity .15s;cursor:pointer;border:none}
        .btn:hover{opacity:.8}
        input,select{outline:none}
        input::placeholder{color:#3d6b4a}
        .shimmer{animation:sh 1.5s infinite linear;background:linear-gradient(90deg,#0a1a0f 25%,#1a3a24 50%,#0a1a0f 75%);background-size:200% 100%}
        @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .spin{display:inline-block;animation:sp 1s linear infinite}
        @keyframes sp{to{transform:rotate(360deg)}}
        .blink{animation:bl 2s ease-in-out infinite}
        @keyframes bl{0%,100%{opacity:.4}50%{opacity:1}}
      `}</style>

      {/* ── NAME MODAL ──────────────────────────────────────────────────── */}
      {showNameModal && (
        <div style={{ position:"fixed", inset:0, background:"#000d", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:"#0d1a10", border:"1px solid #2d7a45", borderRadius:10, padding:28, width:320, textAlign:"center" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:"#c8f5d4", letterSpacing:2, marginBottom:4 }}>WHO ARE YOU?</div>
            <div style={{ fontSize:10, color:"#3d6b4a", letterSpacing:2, marginBottom:16 }}>SO WE KNOW WHO LAST TOUCHED THE SHEET</div>
            <input value={nameInput} onChange={e=>setNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName()}
              placeholder="Wayne or Tommy..." autoFocus
              style={{ width:"100%", background:"#0a1a0f", border:"1px solid #1a3a24", color:"#c8f5d4", borderRadius:6, padding:"10px 14px", fontSize:13, fontFamily:"inherit", marginBottom:12 }} />
            <button onClick={saveName} className="btn" style={{ width:"100%", background:"#10b981", color:"#0a0f0d", borderRadius:6, padding:10, fontSize:11, letterSpacing:2, fontFamily:"inherit", fontWeight:600 }}>LET'S GO ⚽</button>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ background:"linear-gradient(135deg,#0d1f12,#0a0f0d)", borderBottom:"1px solid #1a3a24", padding:"20px 24px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:11, letterSpacing:4, color:"#2d7a45", marginBottom:4 }}>WAYNE × TOMMY</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, letterSpacing:2, color:"#c8f5d4", lineHeight:1 }}>WORLD CUP 2026</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, color:"#2d7a45" }}>BETTING SHEET</div>
              <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <div className="blink" style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", flexShrink:0 }} />
                <span style={{ fontSize:9, letterSpacing:2, color:"#3d6b4a" }}>
                  SHARED · {lastEditor ? `LAST EDIT: ${lastEditor.toUpperCase()}` : "NO EDITS YET"}
                  {lastUpdated ? ` · ${new Date(lastUpdated).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}` : ""}
                </span>
                {userName && <span style={{ fontSize:9, color:"#2d7a45", letterSpacing:1 }}>· YOU: {userName.toUpperCase()} <button onClick={()=>{setNameInput("");setShowNameModal(true);}} className="btn" style={{ background:"none", color:"#1e4d2b", fontSize:9, fontFamily:"inherit", padding:0 }}>[change]</button></span>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#3d6b4a", marginBottom:2 }}>JUNE 11 – JULY 19 · 2026</div>
              <div style={{ fontSize:10, letterSpacing:3, color:"#3d6b4a" }}>USA · CANADA · MEXICO</div>
              <div style={{ marginTop:8, fontSize:32, fontFamily:"'Bebas Neue',sans-serif", color:remaining>=0?"#10b981":"#ef4444", letterSpacing:1 }}>${remaining.toFixed(2)} LEFT</div>
            </div>
          </div>

          <div style={{ marginTop:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#3d6b4a", marginBottom:5, letterSpacing:2 }}>
              <span>STAKED ${totalStaked.toFixed(2)}</span><span>BUDGET $200.00</span>
            </div>
            <div style={{ height:4, background:"#1a2e1f", borderRadius:2 }}>
              <div style={{ height:"100%", width:`${Math.min((totalStaked/TOTAL_BUDGET)*100,100)}%`, background:remaining>=0?"linear-gradient(90deg,#10b981,#2d7a45)":"#ef4444", borderRadius:2, transition:"width 0.4s" }} />
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:14 }}>
            {[{l:"TOTAL BETS",v:bets.length},{l:"POTENTIAL WIN",v:`$${totalPotential.toFixed(0)}`,c:"#10b981"},{l:"CASHED",v:`$${won.toFixed(2)}`,c:"#10b981"},{l:"LOST",v:`$${lost.toFixed(2)}`,c:"#ef4444"}].map(s=>(
              <div key={s.l} style={{ background:"#0d1a10", border:"1px solid #1a2e1f", borderRadius:6, padding:"8px 12px" }}>
                <div style={{ fontSize:9, letterSpacing:2, color:"#3d6b4a", marginBottom:3 }}>{s.l}</div>
                <div style={{ fontSize:18, fontFamily:"'Bebas Neue',sans-serif", color:s.c||"#c8f5d4", letterSpacing:1 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 24px" }}>

        {/* ── ODDS SEARCH ──────────────────────────────────────────────── */}
        <div style={{ background:"#0d1a10", border:"1px solid #1a3a24", borderRadius:8, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:10, letterSpacing:3, color:"#2d7a45", marginBottom:10 }}>⚡ LIVE ODDS SEARCH</div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={aiQuery} onChange={e=>setAiQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchOdds()}
              placeholder="e.g. Haaland top scorer... England vs France group odds..."
              style={{ flex:1, background:"#0a1a0f", border:"1px solid #1a3a24", borderRadius:6, padding:"10px 14px", color:"#c8f5d4", fontSize:12, fontFamily:"inherit" }} />
            <button onClick={searchOdds} disabled={aiLoading} className="btn"
              style={{ background:"#1e4d2b", color:"#c8f5d4", borderRadius:6, padding:"10px 18px", fontSize:11, letterSpacing:2, fontFamily:"inherit" }}>
              {aiLoading ? "..." : "SEARCH"}
            </button>
          </div>
          {aiLoading && <div className="shimmer" style={{ marginTop:12, borderRadius:6, height:60 }} />}
          {aiResults && !aiLoading && (
            <div style={{ marginTop:12, background:"#0a1a0f", border:"1px solid #1a3a24", borderRadius:6, padding:14, fontSize:12, lineHeight:1.7, color:"#a7d9b4", whiteSpace:"pre-wrap" }}>{aiResults}</div>
          )}
        </div>

        {/* ── MAIN TABS ────────────────────────────────────────────────── */}
        <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:"1px solid #1a2e1f" }}>
          {[{k:"bets",l:"📋 MY BETS"},{k:"parlays",l:"🔗 PARLAY IDEAS"}].map(t=>(
            <button key={t.k} onClick={()=>setActiveTab(t.k)} className="btn"
              style={{ background:"none", border:"none", borderBottom:activeTab===t.k?"2px solid #10b981":"2px solid transparent", color:activeTab===t.k?"#c8f5d4":"#3d6b4a", padding:"8px 18px", fontSize:11, letterSpacing:2, fontFamily:"inherit", marginBottom:"-1px" }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ── BETS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "bets" && (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["All",...CATEGORIES].map(cat=>(
                  <button key={cat} onClick={()=>setActiveCategory(cat)} className="btn"
                    style={{ background:activeCategory===cat?"#1e4d2b":"#0d1a10", border:`1px solid ${activeCategory===cat?"#2d7a45":"#1a2e1f"}`, color:activeCategory===cat?"#c8f5d4":"#3d6b4a", borderRadius:4, padding:"5px 12px", fontSize:10, letterSpacing:2, fontFamily:"inherit" }}>
                    {CATEGORY_ICONS[cat]||"📋"} {cat.toUpperCase()}
                  </button>
                ))}
              </div>
              <button onClick={openAdd} className="btn" style={{ background:"#10b981", color:"#0a0f0d", borderRadius:6, padding:"7px 16px", fontSize:11, letterSpacing:2, fontFamily:"inherit", fontWeight:600 }}>+ ADD BET</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {filtered.length===0 && <div style={{ textAlign:"center", padding:40, color:"#3d6b4a", fontSize:11, letterSpacing:3 }}>NO BETS IN THIS CATEGORY</div>}
              {filtered.map(bet => {
                const payout = calcPayout(parseFloat(bet.stake), bet.odds);
                return (
                  <div key={bet.id} className="card" style={{ background:"#0d1a10", borderRadius:8, padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                      <div style={{ flex:1, minWidth:180 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                          <span style={{ fontSize:10, letterSpacing:2, color:"#2d7a45" }}>{CATEGORY_ICONS[bet.category]} {bet.category.toUpperCase()}</span>
                          <span style={{ fontSize:9, background:STATUS_COLORS[bet.status]+"22", color:STATUS_COLORS[bet.status], border:`1px solid ${STATUS_COLORS[bet.status]}44`, borderRadius:3, padding:"1px 6px", letterSpacing:1 }}>{bet.status.toUpperCase()}</span>
                        </div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#c8f5d4", letterSpacing:1 }}>{bet.team}</div>
                        <div style={{ fontSize:11, color:"#5a8f6a", marginTop:1 }}>{bet.description}</div>
                        {bet.note && <div style={{ fontSize:10, color:"#3d6b4a", marginTop:4, fontStyle:"italic" }}>"{bet.note}"</div>}
                        <div style={{ marginTop:8, fontSize:10, color:"#3d6b4a", letterSpacing:1 }}>📍 {bet.platform}</div>
                      </div>
                      <div style={{ textAlign:"right", minWidth:110 }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:parseInt(bet.odds)>0?"#10b981":"#f59e0b", letterSpacing:1 }}>{bet.odds}</div>
                        <div style={{ fontSize:11, color:"#5a8f6a" }}>Stake: <span style={{ color:"#c8f5d4" }}>${bet.stake}</span></div>
                        <div style={{ fontSize:11, color:"#5a8f6a" }}>Win: <span style={{ color:"#10b981" }}>+${payout.toFixed(2)}</span></div>
                        <div style={{ fontSize:11, color:"#5a8f6a" }}>Total: <span style={{ color:"#a7d9b4" }}>${(payout+parseFloat(bet.stake)).toFixed(2)}</span></div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
                      <select value={bet.status} onChange={e=>updateStatus(bet.id,e.target.value)}
                        style={{ background:"#0a1a0f", border:"1px solid #1a3a24", color:STATUS_COLORS[bet.status], borderRadius:4, padding:"4px 8px", fontSize:10, fontFamily:"inherit", cursor:"pointer" }}>
                        {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <button onClick={()=>openEdit(bet)} className="btn" style={{ background:"#1a3a24", color:"#c8f5d4", borderRadius:4, padding:"4px 12px", fontSize:10, letterSpacing:1, fontFamily:"inherit" }}>EDIT</button>
                      <button onClick={()=>deleteBet(bet.id)} className="btn" style={{ background:"#2a0f0f", color:"#ef4444", borderRadius:4, padding:"4px 12px", fontSize:10, letterSpacing:1, fontFamily:"inherit" }}>REMOVE</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PARLAYS TAB ──────────────────────────────────────────────── */}
        {activeTab === "parlays" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:13, color:"#c8f5d4", marginBottom:3 }}>Parlay Ideas</div>
                <div style={{ fontSize:10, letterSpacing:1, color: parlayStatus==="live" ? "#10b981" : parlayStatus==="error" ? "#f59e0b" : "#3d6b4a" }}>
                  {parlayStatus==="live" ? "✓ Live odds loaded" : parlayStatus==="error" ? "⚠ Showing curated suggestions (live search unavailable)" : "Curated suggestions · Refresh for live AI picks"}
                </div>
              </div>
              <button onClick={refreshParlaysLive} disabled={parlayLoading} className="btn"
                style={{ background:parlayLoading?"#1a3a24":"#1e4d2b", color:"#c8f5d4", borderRadius:6, padding:"8px 18px", fontSize:11, letterSpacing:2, fontFamily:"inherit", display:"flex", alignItems:"center", gap:8 }}>
                {parlayLoading ? <><span className="spin">⟳</span> SEARCHING...</> : "⚡ REFRESH LIVE"}
              </button>
            </div>

            {parlayLoading && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[1,2,3,4,5].map(i=><div key={i} className="shimmer" style={{ height:130, borderRadius:8 }} />)}
              </div>
            )}

            {!parlayLoading && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {parlays.map(p => {
                  const payout = calcPayout(p.suggestedStake, p.estimatedOdds);
                  return (
                    <div key={p.id} className="card" style={{ background:"#0d1a10", borderRadius:8, padding:"16px 18px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ marginBottom:8 }}>
                            <span style={{ fontSize:9, letterSpacing:2, background:RISK_COLORS[p.riskLevel]+"22", color:RISK_COLORS[p.riskLevel], border:`1px solid ${RISK_COLORS[p.riskLevel]}44`, borderRadius:3, padding:"2px 8px" }}>
                              {p.riskLevel?.toUpperCase()} RISK
                            </span>
                          </div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:"#c8f5d4", letterSpacing:1, marginBottom:10 }}>{p.name}</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:10 }}>
                            {(p.legs||[]).map((leg,i)=>(
                              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:"#a7d9b4" }}>
                                <span style={{ color:"#2d7a45", fontSize:9, letterSpacing:2, minWidth:36 }}>LEG {i+1}</span>
                                <span>{leg}</span>
                              </div>
                            ))}
                          </div>
                          {p.rationale && <div style={{ fontSize:10, color:"#3d6b4a", fontStyle:"italic", lineHeight:1.6 }}>"{p.rationale}"</div>}
                        </div>
                        <div style={{ textAlign:"right", minWidth:120 }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, color:"#10b981", letterSpacing:1 }}>{p.estimatedOdds}</div>
                          <div style={{ fontSize:9, color:"#3d6b4a", letterSpacing:2, marginBottom:4 }}>EST. ODDS</div>
                          <div style={{ fontSize:11, color:"#5a8f6a" }}>Suggested: <span style={{ color:"#c8f5d4" }}>${p.suggestedStake}</span></div>
                          <div style={{ fontSize:11, color:"#5a8f6a" }}>Est. Win: <span style={{ color:"#10b981" }}>+${payout.toFixed(0)}</span></div>
                          <div style={{ fontSize:11, color:"#5a8f6a" }}>Total: <span style={{ color:"#a7d9b4" }}>${(payout+p.suggestedStake).toFixed(0)}</span></div>
                        </div>
                      </div>
                      <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1a2e1f" }}>
                        <button onClick={()=>addParlayAsBet(p)} className="btn"
                          style={{ background:"#1e4d2b", color:"#c8f5d4", borderRadius:6, padding:"6px 14px", fontSize:10, letterSpacing:2, fontFamily:"inherit" }}>
                          + ADD TO MY BETS
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:24, textAlign:"center", fontSize:9, letterSpacing:3, color:"#1e4d2b" }}>PLEASE GAMBLE RESPONSIBLY · 21+ ONLY · SYNCS EVERY 30 SECONDS</div>
      </div>

      {/* ── ADD/EDIT MODAL ───────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"#000a", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:16 }}>
          <div style={{ background:"#0d1a10", border:"1px solid #2d7a45", borderRadius:10, padding:24, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#c8f5d4", letterSpacing:2, marginBottom:18 }}>{editingBet?"EDIT BET":"ADD BET"}</div>
            {[
              {label:"CATEGORY",    field:"category",    type:"select", opts:CATEGORIES},
              {label:"TEAM / NAME", field:"team",        type:"text",   ph:"e.g. Spain"},
              {label:"DESCRIPTION", field:"description", type:"text",   ph:"e.g. To win the World Cup"},
              {label:"ODDS (American)", field:"odds",    type:"text",   ph:"e.g. +550 or -110"},
              {label:"STAKE ($)",   field:"stake",       type:"number", ph:"e.g. 20"},
              {label:"PLATFORM",    field:"platform",    type:"select", opts:PLATFORMS},
              {label:"STATUS",      field:"status",      type:"select", opts:STATUSES},
              {label:"NOTE (optional)", field:"note",    type:"text",   ph:"e.g. Strong value play"},
            ].map(({label,field,type,opts,ph})=>(
              <div key={field} style={{ marginBottom:12 }}>
                <div style={{ fontSize:9, letterSpacing:3, color:"#3d6b4a", marginBottom:4 }}>{label}</div>
                {type==="select"
                  ? <select value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                      style={{ width:"100%", background:"#0a1a0f", border:"1px solid #1a3a24", color:"#c8f5d4", borderRadius:6, padding:"9px 12px", fontSize:12, fontFamily:"inherit", cursor:"pointer" }}>
                      {opts.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  : <input type={type} value={form[field]} placeholder={ph} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}
                      style={{ width:"100%", background:"#0a1a0f", border:"1px solid #1a3a24", color:"#c8f5d4", borderRadius:6, padding:"9px 12px", fontSize:12, fontFamily:"inherit" }} />
                }
              </div>
            ))}
            {form.odds && form.stake && (
              <div style={{ background:"#0a1a0f", border:"1px solid #1a3a24", borderRadius:6, padding:10, marginBottom:14, fontSize:11, color:"#5a8f6a" }}>
                Win: <span style={{ color:"#10b981", fontFamily:"'Bebas Neue',sans-serif", fontSize:16 }}>+${calcPayout(parseFloat(form.stake),form.odds).toFixed(2)}</span>
                &nbsp;· Total: <span style={{ color:"#c8f5d4" }}>${(calcPayout(parseFloat(form.stake),form.odds)+parseFloat(form.stake||0)).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setShowForm(false)} className="btn" style={{ flex:1, background:"#1a2e1f", color:"#5a8f6a", borderRadius:6, padding:10, fontSize:11, letterSpacing:2, fontFamily:"inherit" }}>CANCEL</button>
              <button onClick={saveBet} className="btn" style={{ flex:2, background:"#10b981", color:"#0a0f0d", borderRadius:6, padding:10, fontSize:11, letterSpacing:2, fontFamily:"inherit", fontWeight:600 }}>{editingBet?"SAVE CHANGES":"ADD BET"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
