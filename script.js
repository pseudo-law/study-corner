const $ = (id) => document.getElementById(id);
const SETS_KEY = "pixelStudy.sets.v1";
const PROG_KEY = "pixelStudy.progress.v1";
let sets = load(SETS_KEY, []);
let editingId = null, activeSetId = null, session = null;
function load(k, fb){ try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; }catch{ return fb; } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function uid(){ return "id-" + Date.now().toString(36) + "-" + Math.floor(Math.random()*1e6); }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function norm(s){ return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._x); t._x = setTimeout(()=>t.classList.add("hidden"), 2200); }
function getProgress(){ return load(PROG_KEY, {streak:0,lastDay:"",sessions:0,best:null}); }
function setProgress(p){ save(PROG_KEY, p); renderStats(); }
function show(page){
document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
$("page-"+page).classList.add("active");
window.scrollTo({top:0});
}
function cardCount(s){ return s.cards.length; }
function setCardHTML(s){
return `<div class="set-card"><h3>${esc(s.title)}</h3><p>${esc(s.description||"")}</p><p><b>${cardCount(s)} cards</b></p><div class="row"><button class="btn primary" data-study="${s.id}">Study</button><button class="btn" data-open="${s.id}">Open</button></div></div>`;
}
function renderAll(){
$("homeSets").innerHTML = sets.slice(0,6).map(setCardHTML).join("") || "<p>No sets yet.</p>";
$("allSets").innerHTML = sets.map(setCardHTML).join("") || "<p>No sets yet.</p>";
document.querySelectorAll("[data-study]").forEach(b=>b.onclick=()=>startStudy(b.dataset.study));
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
renderStats();
}
function renderStats(){
$("statSets").textContent = sets.length;
$("statCards").textContent = sets.reduce((n,s)=>n+s.cards.length,0);
const p = getProgress();
$("statStreak").textContent = p.streak; $("streakBadge").textContent = p.streak;
}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{
const n=b.dataset.nav;
if(n==="create") openEditor(null);
else{ if(n==="progress") renderProgress(); show(n); renderAll(); }
}));
function blankCardRow(c={}){
const d=document.createElement("div"); d.className="card-row";
d.innerHTML=`<label class="field"><span>Question *</span><input type="text" data-f="q" value="${esc(c.q||"")}" /></label>
<label class="field"><span>Correct answer *</span><input type="text" data-f="a" value="${esc(c.a||"")}" /></label>
<label class="field"><span>Alternatives (comma separated)</span><input type="text" data-f="alt" value="${esc(c.alt||"")}" /></label>
<label class="field"><span>Topic</span><input type="text" data-f="topic" value="${esc(c.topic||"")}" /></label>
<label class="field"><span>Explanation *</span><input type="text" data-f="expl" value="${esc(c.expl||"")}" /></label>
<button class="btn danger" data-del>Delete card</button>`;
d.querySelector("[data-del]").onclick=()=>{ if(document.querySelectorAll(".card-row").length<=1){toast("Keep at least 1 card");return;} d.remove(); };
return d;
}
function openEditor(id){
editingId=id;
const s=sets.find(x=>x.id===id);
$("editorTitle").textContent=s?"Edit set":"Create a new set";
$("setTitle").value=s?.title||""; $("setDesc").value=s?.description||"";
$("cardEditor").innerHTML="";
(s?.cards?.length?s.cards:[{},{}]).forEach(c=>$("cardEditor").appendChild(blankCardRow(c)));
show("create");
}
$("addCardBtn").onclick=()=>$("cardEditor").appendChild(blankCardRow({}));
$("cancelEditBtn").onclick=()=>{editingId=null;show("home");renderAll();};
$("goCreateBtn").onclick=()=>openEditor(null);
$("goStudyBtn").onclick=()=>{ if(!sets.length){toast("Create a set first!");openEditor(null);return;} openDetail(sets[0].id); };
$("saveSetBtn").onclick=()=>{
const title=$("setTitle").value.trim();
if(!title){toast("Please add a set title");return;}
const rows=[...document.querySelectorAll(".card-row")];
const cards=[];
for(let i=0;i<rows.length;i++){
const g=(f)=>rows[i].querySelector(`[data-f="${f}"]`).value;
const q=g("q").trim(),a=g("a").trim(),expl=g("expl").trim();
if(!q&&!a&&!g("alt").trim()&&!expl) continue;
if(!q||!a){toast(`Card ${i+1}: question + answer required`);return;}
if(!expl){toast(`Card ${i+1}: please add explanation`);return;}
cards.push({q,a,alt:g("alt").trim(),topic:g("topic").trim(),expl});
}
if(!cards.length){toast("Add at least 1 complete card");return;}
if(editingId){ Object.assign(sets.find(x=>x.id===editingId),{title,description:$("setDesc").value.trim(),cards}); toast("Set updated!"); }
else{ sets.unshift({id:uid(),title,description:$("setDesc").value.trim(),cards,createdAt:Date.now()}); toast("Set saved!"); }
save(SETS_KEY,sets); editingId=null; renderAll(); show("home");
};
function openDetail(id){
activeSetId=id;
const s=sets.find(x=>x.id===id); if(!s) return;
$("detailTitle").textContent=s.title; $("detailDesc").textContent=s.description||"";
$("detailCount").textContent=s.cards.length+" cards";
$("detailDate").textContent=new Date(s.createdAt||Date.now()).toLocaleDateString();
$("detailPreview").innerHTML=s.cards.map((c,i)=>`<div class="preview-item"><b>${i+1}. ${esc(c.q)}</b><br/><span class="muted">Answer: ${esc(c.a)}</span></div>`).join("");
show("detail");
}
$("studySetBtn").onclick=()=>startStudy(activeSetId);
$("editSetBtn").onclick=()=>openEditor(activeSetId);
$("deleteSetBtn").onclick=()=>{
if(!confirm("Delete this set permanently?")) return;
sets=sets.filter(x=>x.id!==activeSetId); save(SETS_KEY,sets); renderAll(); show("home"); toast("Set deleted");
};
function acceptedAnswers(c){ return [c.a, ...(c.alt||"").split(",")].map(norm).filter(Boolean); }
function startStudy(id, onlyMissed){
const s=sets.find(x=>x.id===id); if(!s||!s.cards.length){toast("No cards to study");return;}
let cards=s.cards.map((c,i)=>({...c,_idx:i}));
if(onlyMissed?.length) cards=cards.filter(c=>onlyMissed.includes(c._idx));
session={setId:id,setTitle:s.title,cards,idx:0,correct:0,wrong:0,locked:false,results:[]};
show("study"); renderCard();
}
function renderCard(){
const c=session.cards[session.idx];
session.locked=false;
$("studySetName").textContent=session.setTitle;
$("studyProgress").textContent=`Card ${session.idx+1} of ${session.cards.length}`;
$("studyCorrect").textContent=session.correct; $("studyWrong").textContent=session.wrong;
$("progressFill").style.width=`${(session.idx/session.cards.length)*100}%`;
$("qNum").textContent=String(session.idx+1).padStart(2,"0");
$("qTotal").textContent=String(session.cards.length).padStart(2,"0");
$("studyQuestion").textContent=c.q;
$("studyMascot").textContent="(^_^)";
$("answerInput").value=""; $("answerInput").disabled=false;
$("submitAnswerBtn").disabled=false;
$("feedback").className="feedback hidden";
setTimeout(()=>$("answerInput").focus(),50);
}
$("submitAnswerBtn").onclick=submitAnswer;
$("answerInput").addEventListener("keydown",e=>{ if(e.key==="Enter") submitAnswer(); });
$("skipBtn").onclick=()=>{ if(!session||session.locked) return; session.locked=true; recordResult(true); showFeedback(true); };
function submitAnswer(){
if(!session||session.locked) return;
const raw=$("answerInput").value;
if(!norm(raw)){ toast("Please type an answer first!"); return; }
session.locked=true;
recordResult(false, raw);
showFeedback(false, raw);
}
function recordResult(skipped, raw){
const c=session.cards[session.idx];
const ok=!skipped && acceptedAnswers(c).includes(norm(raw||""));
if(ok){ session.correct++; session.results.push({card:c,yours:raw,ok:true}); }
else{ session.wrong++; session.results.push({card:c,yours:raw||"(skipped)",ok:false}); }
$("studyCorrect").textContent=session.correct; $("studyWrong").textContent=session.wrong;
}
function showFeedback(skipped, raw){
const c=session.cards[session.idx];
const ok=!skipped && acceptedAnswers(c).includes(norm(raw||""));
const fb=$("feedback");
fb.className="feedback "+(ok?"correct":"wrong");
$("feedbackBanner").textContent=ok?"Correct! Great job!":(skipped?"Skipped - no worries!":"Not quite! Don't give up.");
$("fbYours").textContent=raw||"(skipped)";
$("fbExpected").textContent=c.a+((c.alt)?`  (also accepts: ${c.alt})`:"");
$("fbExpl").textContent=c.expl||"No explanation yet.";
$("studyMascot").textContent=ok?"\\(^_^)/":`(>_<)`;
$("answerInput").disabled=true; $("submitAnswerBtn").disabled=true;
$("nextBtn").textContent=session.idx+1>=session.cards.length?"See Results":"Next Question";
$("progressFill").style.width=`${((session.idx+1)/session.cards.length)*100}%`;
}
$("nextBtn").onclick=()=>nextCard(false);
function nextCard(wasSkip){
if(session.idx+1>=session.cards.length) return finishSession();
session.idx++; renderCard();
}
function finishSession(){
$("scoreCorrect").textContent=session.correct;
$("scoreTotal").textContent=session.cards.length;
const pct=session.cards.length?Math.round(session.correct/session.cards.length*100):0;
$("resultsTitle").textContent=pct===100?"Perfect! Pixel Star!":pct>=70?"Great studying!":pct>=40?"Good effort! Keep going!":"Don't give up - retry!";
$("resultsMascot").textContent=pct===100?"*":pct>=70?"(^_^)":`(>_<)`;
const badges=[];
if(pct===100) badges.push("PERFECT");
if(session.correct>=5) badges.push("5+ CORRECT");
if(session.wrong===0&&session.cards.length>0) badges.push("FLAWLESS");
if(session.cards.length>=5) badges.push("BIG SET");
$("badgeBox").innerHTML=badges.map(b=>`<span class="badge">${b}</span>`).join("")||"<span class='muted'>Answer more to earn badges</span>";
$("reviewList").innerHTML=session.results.map((r,i)=>`<div class="preview-item ${r.ok?"correct":"wrong"}"><b>${i+1}. ${esc(r.card.q)}</b><br/>Yours: ${esc(r.yours)}<br/>Correct: ${esc(r.card.a)}<br/><span class="muted">${esc(r.card.expl)}</span></div>`).join("");
const p=getProgress();
const today=new Date().toDateString();
if(p.lastDay!==today){ p.streak=(p.lastDay&&((Date.now()-new Date(p.lastDay).getTime())<86400000*2))?p.streak+1:1; p.lastDay=today; }
p.sessions++;
const score=`${session.correct}/${session.cards.length}`;
if(!p.best||session.correct>parseInt(p.best)) p.best=score;
setProgress(p);
const missed=session.results.map((r,i)=>r.ok?null:session.cards[i]._idx).filter(v=>v!=null);
$("retryMissedBtn").style.display=missed.length?"":"none";
$("retryMissedBtn").onclick=()=>startStudy(session.setId,missed);
show("results");
}
$("retryMissedBtn").onclick=()=>{};
$("backHomeBtn").onclick=()=>{renderAll();show("home");};
function renderProgress(){
const p=getProgress();
$("progressStreak").textContent=p.streak; $("progressSessions").textContent=p.sessions; $("progressBest").textContent=p.best||"-";
}
$("resetProgressBtn").onclick=()=>{ if(confirm("Reset streak + sessions?")){ setProgress({streak:0,lastDay:"",sessions:0,best:null}); renderProgress(); } };
if(!sets.length){
sets=[{id:uid(),title:"OOP Basics",description:"Starter pixel set",createdAt:Date.now(),cards:[
{q:"What is encapsulation?",a:"Encapsulation",alt:"Data encapsulation",topic:"OOP",expl:"Encapsulation bundles data and methods while controlling access."},
{q:"What does OOP stand for?",a:"Object-Oriented Programming",alt:"OOP, object oriented programming",topic:"OOP",expl:"OOP organizes code into objects combining state and behavior."},
{q:"What is inheritance?",a:"Inheritance",alt:"",topic:"OOP",expl:"Inheritance lets a class reuse and extend a parent class."}
]}];
save(SETS_KEY,sets);
}
// Swap emoji buddies for PNGs when the files exist
document.querySelectorAll(".buddy[data-img]").forEach(el=>{
const src=el.dataset.img;
const img=new Image();
img.onload=()=>{ el.style.backgroundImage=`url("${src}")`; el.classList.add("has-img"); };
img.src=src;
});

// ---- Study Docs: import -> read -> summarize -> quiz ----
const DOCS_KEY = "pixelStudy.docs.v1";
let docs = load(DOCS_KEY, []);
let activeDocId = null;
let draftQuiz = [];
function getDocText(){ return ($("docInput").value || "").trim(); }
function setDocText(t){ $("docInput").value = t; renderDocReader(); }
function renderDocReader(){
const t = getDocText();
if(!t){ $("docReader").innerHTML = `<p class="muted">No document yet.</p>`; return; }
const paras = t.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
$("docReader").innerHTML = paras.map(p=>{
if(/^#{1,3}\s/.test(p)) return `<h4>${esc(p.replace(/^#{1,3}\s*/, ""))}</h4>`;
return `<p>${esc(p)}</p>`;
}).join("");
}
function hideDocOutputs(){ $("docSummaryPanel").classList.add("hidden"); $("docQuizPanel").classList.add("hidden"); }
function persistActiveDoc(){
const t = getDocText(); if(!t) return;
const title = $("docTitle").value.trim() || "Untitled doc";
if(activeDocId){
const d = docs.find(x=>x.id===activeDocId);
if(d){ d.title=title; d.text=t; d.updatedAt=Date.now(); }
}else{
activeDocId = uid();
docs.unshift({id:activeDocId, title, text:t, createdAt:Date.now(), updatedAt:Date.now()});
}
save(DOCS_KEY, docs); renderDocsList();
}
function renderDocsList(){
const el = $("docsList"); if(!el) return;
el.innerHTML = docs.map(d=>`<div class="set-card"><h3>${esc(d.title)}</h3><p>${esc((d.text||"").slice(0,90))}...</p><div class="row"><button class="btn primary" data-loaddoc="${d.id}">Open</button><button class="btn danger" data-deldoc="${d.id}">Delete</button></div></div>`).join("") || "<p class='muted'>No saved docs yet.</p>";
el.querySelectorAll("[data-loaddoc]").forEach(b=>b.onclick=()=>{
const d = docs.find(x=>x.id===b.dataset.loaddoc); if(!d) return;
activeDocId = d.id; $("docTitle").value = d.title; setDocText(d.text); hideDocOutputs(); show("docs");
});
el.querySelectorAll("[data-deldoc]").forEach(b=>b.onclick=()=>{
if(!confirm("Delete this doc?")) return;
docs = docs.filter(x=>x.id!==b.dataset.deldoc);
if(activeDocId===b.dataset.deldoc) activeDocId=null;
save(DOCS_KEY, docs); renderDocsList();
});
}
$("docInput").addEventListener("input", ()=>{ renderDocReader(); hideDocOutputs(); });
$("docFile").addEventListener("change", async (e)=>{
const f = e.target.files[0]; if(!f) return;
const name = f.name || "";
const ext = (name.split(".").pop() || "").toLowerCase();
try{
toast("Reading file...");
let text = "";
if(ext === "pdf"){
if(!window.pdfjsLib){ toast("PDF reader failed to load (need internet for CDN). Try .txt instead."); return; }
window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const buf = await f.arrayBuffer();
const pdf = await window.pdfjsLib.getDocument({data: buf}).promise;
const pages = [];
const max = Math.min(pdf.numPages, 50);
for(let p=1; p<=max; p++){
const page = await pdf.getPage(p);
const tc = await page.getTextContent();
pages.push(tc.items.map(it=>it.str).join(" "));
}
text = pages.join("\n\n");
}else if(ext === "docx"){
if(!window.mammoth){ toast("Word reader failed to load (need internet for CDN). Try .txt instead."); return; }
const buf = await f.arrayBuffer();
const out = await window.mammoth.extractRawText({arrayBuffer: buf});
text = out.value || "";
}else if(ext === "doc"){
toast("Old .doc files can't be read in-browser. In Word: File > Save As > .docx, then import that.");
return;
}else if(/\.(txt|md|markdown)$/i.test(name) || String(f.type||"").startsWith("text/")){
text = await f.text();
}else{
toast("Please import .txt, .md, .docx, or .pdf");
return;
}
text = String(text||"").replace(/\r/g, "").trim();
if(!text){ toast("No readable text found in that file (scanned PDF images need OCR)."); return; }
if(text.length > 60000){ text = text.slice(0, 60000); toast("Big file! Using first 60k characters."); }
if(!$("docTitle").value) $("docTitle").value = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
setDocText(text); hideDocOutputs(); persistActiveDoc();
toast("Document loaded - happy reading!");
}catch(err){
console.error(err);
toast("Could not read that file. Try .txt or .docx.");
}finally{
e.target.value = "";
}
});
$("docClearBtn").onclick = ()=>{ setDocText(""); $("docTitle").value=""; activeDocId=null; hideDocOutputs(); renderDocsList(); };
function splitSentences(text){
return (String(text).replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["']?|\S[^.!?]*$/g) || []).map(s=>s.trim()).filter(s=>s.length > 25);
}
function scoreSentence(s, freq){
const words = s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w=>w.length>3);
let score = 0;
words.forEach(w=>{ score += (freq[w] || 0); });
if(/^(in summary|overall|therefore|because|important|key|note that|remember|definition|means|refers to)/i.test(s)) score += 5;
if(s.length > 200) score -= 3;
return score / Math.sqrt(words.length + 1);
}
$("docSummaryBtn").onclick = ()=>{
const t = getDocText();
if(!t){ toast("Import or paste notes first!"); return; }
const sents = splitSentences(t);
if(!sents.length){ toast("Not enough text to summarize"); return; }
const freq = {};
t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).forEach(w=>{ if(w.length>3) freq[w]=(freq[w]||0)+1; });
const ranked = sents.map((s,i)=>({s, i, sc:scoreSentence(s, freq)})).sort((a,b)=>b.sc-a.sc);
const n = Math.min(6, Math.max(3, Math.round(sents.length/4)));
const top = ranked.slice(0, n).sort((a,b)=>a.i-b.i);
$("docSummaryList").innerHTML = top.map(x=>`<li>${esc(x.s)}</li>`).join("");
$("docSummaryPanel").classList.remove("hidden");
persistActiveDoc();
};
function makeQuestionsFromText(t){
const sents = splitSentences(t);
const cards = [];
const seen = new Set();
const topic = $("docTitle").value.trim() || "Study Doc";
const push = (q, a, expl)=>{
const k = norm(q);
if(!q || !a || seen.has(k)) return;
seen.add(k);
cards.push({q, a, alt:"", topic, expl});
};
const isRe = /^(.{3,60}?)\s+(is|are|means?|refers to|describes?)\s+(.{10,160}?)[.!?]$/i;
for(const s of sents){
if(cards.length >= 10) break;
const m = s.match(isRe);
if(!m) continue;
const term = m[1].trim(), rest = m[3].trim();
if(term.split(/\s+/).length > 8) continue;
if(/^(this|that|it|they|these|those|there|here)$/i.test(term)) continue;
const short = rest.split(/,|;/)[0].trim().slice(0,60) || rest;
push(`What ${m[2].toLowerCase()==="are"?"are":"is"} ${term}?`, short, `From your doc: "${s}"`);
}
for(const line of String(t).split("\n")){
if(cards.length >= 12) break;
const m = line.match(/^(.{2,40}?)\s*:\s*(.{10,160})$/);
if(!m) continue;
push(`What does "${m[1].trim()}" mean?`, m[2].trim().split(/[.!?]/)[0], `From your doc: "${line.trim()}"`);
}
for(const s of sents){
if(cards.length >= 12) break;
const words = s.split(/\s+/);
if(words.length < 8) continue;
const key = words.filter(w=>w.length>5).slice(0,3).join(" ");
if(key) push(`Complete this idea: "${s.slice(0,60)}..."?`, s.slice(0,80), `Full sentence: "${s}"`);
}
return cards.slice(0, 10);
}
$("docQuizBtn").onclick = ()=>{
const t = getDocText();
if(!t){ toast("Import or paste notes first!"); return; }
draftQuiz = makeQuestionsFromText(t);
if(!draftQuiz.length){ toast("Could not find quiz-worthy sentences. Try longer notes!"); return; }
$("docQuizList").innerHTML = draftQuiz.map((c,i)=>`<div class="preview-item"><div class="quiz-edit">
<label class="field"><span>Q${i+1}</span><input type="text" data-qq="${i}" value="${esc(c.q)}" /></label>
<label class="field"><span>Answer</span><input type="text" data-qa="${i}" value="${esc(c.a)}" /></label>
<label class="field"><span>Why / explanation</span><input type="text" data-qe="${i}" value="${esc(c.expl)}" /></label>
</div></div>`).join("");
$("docQuizPanel").classList.remove("hidden");
persistActiveDoc();
toast(`${draftQuiz.length} questions drafted - review them!`);
};
$("docSaveQuizBtn").onclick = ()=>{
const rows = [...document.querySelectorAll("#docQuizList .quiz-edit")];
if(!rows.length){ toast("Generate questions first!"); return; }
const cards = [];
rows.forEach((r,i)=>{
const q = r.querySelector(`[data-qq="${i}"]`).value.trim();
const a = r.querySelector(`[data-qa="${i}"]`).value.trim();
const expl = r.querySelector(`[data-qe="${i}"]`).value.trim() || "Generated from your study doc.";
if(q && a) cards.push({q, a, alt:"", topic:$("docTitle").value.trim()||"Study Doc", expl});
});
if(!cards.length){ toast("Keep at least 1 complete question"); return; }
const title = $("docTitle").value.trim() || `Doc Quiz ${new Date().toLocaleDateString()}`;
sets.unshift({id:uid(), title, description:`Auto-made from study doc (${cards.length} cards)`, cards, createdAt:Date.now()});
save(SETS_KEY, sets); renderAll();
toast("Saved! Find it in My Sets.");
openDetail(sets[0].id);
};
const _origShow = show;
show = function(page){
_origShow(page);
if(page==="docs"){ renderDocReader(); renderDocsList(); }
};
renderAll();


