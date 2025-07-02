# ─ delete whole file, paste canvas content ─
# Ctrl-O ↵  → Ctrl-X
// =============================
//  Survey Builder – FULL app.js  (Syntax fixed, full file)
//  Updated: 2025‑07‑02  ➜ closes missing braces / restores end of file
// =============================

/*****   GLOBAL STATE   *****/
const researchState = {
  intro: "",
  previous: "",
  methods: "",
  draftCount: 0,
  questionnaire: { profile: [], yesno: [], likert: [] }
};

/*****   DOM HOOKS   *****/
const $ = id => document.getElementById(id);
const introInput   = $("intro-input");
const prevInput    = $("prevworks-input");
const methodsInput = $("methods-input");
const genBtn       = $("generate-q-btn");
const sendBtn      = $("send-draft-btn");
const regenBtn     = $("regen-q-btn");
const profileList  = $("profile-list");
const yesnoList    = $("yesno-list");
const constructs   = $("constructs-list");
const discBox      = $("discussion-log");
const commentInput = $("comment-input");
const addCmtBtn    = $("add-comment-btn");
const copyJSONBtn  = $("copy-json-btn");
const copyGBtn     = $("copy-script-btn");

/*****   BIND INPUTS   *****/
introInput .oninput = () => researchState.intro    = introInput.value.trim();
prevInput  .oninput = () => researchState.previous = prevInput.value.trim();
methodsInput.oninput = () => researchState.methods = methodsInput.value.trim();

/*****   GPT CALL   *****/
async function callGPT(messages, temperature=0.7, model="gpt-4o"){
  const r = await fetch("/api/openai",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages,temperature,model})});
  if(!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data.choices[0].message.content.trim();
}

/*****   FIRST GENERATE   *****/
genBtn.onclick = async ()=>{
  if(!filled())return;
  genBtn.disabled=true;genBtn.textContent="Generating…";
  try{await buildDraft("");}catch(e){alert(e.message);}finally{
    genBtn.disabled=false;genBtn.textContent="Generate Questionnaire";}
};

/*****   SEND DRAFT TO DISCUSSION   *****/
sendBtn.onclick = ()=>{ if(hasDraft()) pushDraftToDiscussion(); else alert("No draft yet"); };

/*****   DISCUSSION CHAT   *****/
addCmtBtn.onclick = async ()=>{
  const msg = commentInput.value.trim(); if(!msg)return;
  discBox.value += `\n\nYou: ${msg}`; commentInput.value="";
  try{
    const reply = await callGPT([
      {role:"system",content:"You are ChatGPT helping students refine questionnaire items."},
      {role:"user",content:`Current draft:\n${plainLines()}\n\nDiscussion so far:\n${discBox.value}\n\nUser: ${msg}`}
    ]);
    discBox.value += `\nAI: ${reply}`;
    discBox.scrollTop = discBox.scrollHeight;
  }catch(e){alert("Chat error: "+e.message);} }; 

/*****   REGENERATE   *****/
regenBtn.onclick = async ()=>{
  if(!filled())return;
  if(hasDraft()) pushDraftToDiscussion();
  regenBtn.disabled=true;regenBtn.textContent="Regenerating…";
  try{await buildDraft(discBox.value);}catch(e){alert(e.message);}finally{
    regenBtn.disabled=false;regenBtn.textContent="Regenerate Questionnaire";}
};

/*****   BUILD DRAFT   *****/
async function buildDraft(extra){
  const sys = "You are an educational survey designer. Using INTRODUCTION, PREVIOUS WORKS, METHODS, and DISCUSSION below, draft 10‑15 questionnaire items labeled PROFILE:, YESNO:, LIKERT:";
  const user = `INTRODUCTION:\n${researchState.intro}\n\nPREVIOUS WORKS:\n${researchState.previous}\n\nMETHODS:\n${researchState.methods}\n\nDISCUSSION:\n${extra||"(none)"}`;
  const raw = await callGPT([{role:"system",content:sys},{role:"user",content:user}]);
  const q = {profile:[],yesno:[],likert:[]};
  raw.split(/\n+/).forEach((l,i)=>{
    l=l.replace(/^[-*]\s*/,"").trim();
    if(/^PROFILE:/i.test(l)) q.profile.push(l.replace(/PROFILE:/i,"").trim());
    else if(/^YESNO:/i.test(l)) q.yesno.push(l.replace(/YESNO:/i,"").trim());
    else if(/^LIKERT:/i.test(l)) q.likert.push({text:l.replace(/LIKERT:/i,"").trim(), polarity:i%2? -1:1});
  });
  researchState.questionnaire=q; researchState.draftCount++; render();
}

/*****   RENDER   *****/
function render(){
  profileList.innerHTML = researchState.questionnaire.profile.map(t=>`<li>${t}</li>`).join("");
  yesnoList.innerHTML   = researchState.questionnaire.yesno  .map(t=>`<li>${t}</li>`).join("");
  constructs.innerHTML  = researchState.questionnaire.likert.map((o,i)=>{
    return `<div class="item-row"><button onclick="togglePol(${i})">${o.polarity===1?"👍":"👎"}</button><input value="${o.text}" onchange="updateLikert(${i},this.value)"></div>`;
  }).join("");
}
window.togglePol  = i=>{researchState.questionnaire.likert[i].polarity*=-1; render();};
window.updateLikert = (i,v)=>{researchState.questionnaire.likert[i].text=v;};

/*****   HELPERS   *****/
function hasDraft(){const q=researchState.questionnaire;return q.profile.length||q.yesno.length||q.likert.length;}
function filled(){if(!researchState.intro||!researchState.previous||!researchState.methods){alert("Fill Introduction, Previous Works, Methods first");return false;}return true;}
function pushDraftToDiscussion(){if(!hasDraft())return;discBox.value+=`\n\n— Draft #${researchState.draftCount} —\n${plainLines()}`;}
function plainLines(){const q=researchState.questionnaire;return[...q.profile.map(p=>`PROFILE: ${p}`),...q.yesno.map(y=>`YESNO: ${y}`),...q.likert.map(l=>`LIKERT: ${l.text}`)].join("\n");}

/*****   EXPORT BUTTONS   *****/
copyJSONBtn.onclick = ()=>{navigator.clipboard.writeText(JSON.stringify(researchState.questionnaire,null,2));alert("JSON copied");};
copyGBtn.onclick    = ()=>{navigator.clipboard.writeText(genGoogleScript());alert("Google Forms script copied");};

function genGoogleScript(){const q=researchState.questionnaire;let s=`function createForm(){\n const f=FormApp.create('Survey Form');\n`;q.profile.forEach(p=>s+=` f.addTextItem().setTitle('${escape(p)}');\n`);q.yesno.forEach(y=>s+=` f.addMultipleChoiceItem().setTitle('${escape(y)}').setChoiceValues(['Yes','No']);\n`);q.likert.forEach(l=>s+=` f.addScaleItem().setTitle('${escape(l.text)}').setBounds(1,5).setLabels('Strongly disagree','Strongly agree');\n`);return s+`}\n`;}
function escape(str){return str.replace(/'/g,"\\'");}

render();
