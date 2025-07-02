// =============================
//  Survey Builder – FULL app.js  (No‑label mode)
//  Updated: 2025‑07‑02   » removes label requirement; shows raw text block
// =============================

/*****   GLOBAL STATE   *****/
const researchState = {
  intro: "",
  previous: "",
  methods: "",
  draftCount: 0,
  questionnaire: { items: [] }   // one bucket now
};

/*****   DOM HOOKS   *****/
const $ = id => document.getElementById(id);
const introInput   = $("intro-input");
const prevInput    = $("prevworks-input");
const methodsInput = $("methods-input");
const genBtn       = $("generate-q-btn");
const sendBtn      = $("send-draft-btn");
const regenBtn     = $("regen-q-btn");
const itemList     = $("profile-list");       // reuse existing UL
const discBox      = $("discussion-log");
const commentInput = $("comment-input");
const addCmtBtn    = $("add-comment-btn");
const copyJSONBtn  = $("copy-json-btn");
const copyGBtn     = $("copy-script-btn");

/*****   SYNC INPUTS   *****/
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

/*****   MAIN BUTTONS   *****/
function filled(){return researchState.intro&&researchState.previous&&researchState.methods;}

genBtn.onclick = async ()=>{
  if(!filled()){alert("Fill Introduction, Previous Works, Methods first");return;}
  genBtn.disabled=true; genBtn.textContent="Generating…";
  try{await buildDraft("");}catch(e){alert(e.message);}finally{
    genBtn.disabled=false; genBtn.textContent="Generate Questionnaire";}
};

regenBtn.onclick = async ()=>{
  if(!filled())return;
  pushDraftToDiscussion();
  regenBtn.disabled=true; regenBtn.textContent="Regenerating…";
  try{await buildDraft(discBox.value);}catch(e){alert(e.message);}finally{
    regenBtn.disabled=false; regenBtn.textContent="Regenerate Questionnaire";}
};

addCmtBtn.onclick = async ()=>{
  const msg = commentInput.value.trim(); if(!msg) return;
  discBox.value += `\n\nYou: ${msg}`; commentInput.value="";
  try{
    const reply = await callGPT([
      {role:"system",content:"You are ChatGPT helping students refine survey questions."},
      {role:"user",content:`Current draft questions:\n${researchState.questionnaire.items.join("\n")}\n\n${discBox.value}\n\nUser: ${msg}`}
    ]);
    discBox.value += `\nAI: ${reply}`;
    discBox.scrollTop = discBox.scrollHeight;
  }catch(e){alert("Chat error: "+e.message);} };

/*****   BUILD DRAFT (no labels)   *****/
async function buildDraft(extra){
  const sys = "You are an educational survey designer. Using INTRODUCTION, PREVIOUS WORKS, METHODS, and DISCUSSION below, draft 10–15 questionnaire items. Return each question on its own line without any labels.";
  const user = `INTRODUCTION:\n${researchState.intro}\n\nPREVIOUS WORKS:\n${researchState.previous}\n\nMETHODS:\n${researchState.methods}\n\nDISCUSSION:\n${extra||"(none)"}`;
  const raw = await callGPT([{role:"system",content:sys},{role:"user",content:user}]);

  /* parse: keep every non‑empty line */
  researchState.questionnaire.items = raw.split(/\n+/).map(l=>l.replace(/^[-*]\s*/,"").trim()).filter(Boolean);
  researchState.draftCount++;
  render();
}

/*****   RENDER   *****/
function render(){
  itemList.innerHTML = researchState.questionnaire.items.map(t=>`<li>${t}</li>`).join("");
}

/*****   UTILITIES   *****/
function pushDraftToDiscussion(){
  if(!researchState.questionnaire.items.length) return;
  discBox.value += `\n\n— Draft #${researchState.draftCount} —\n${researchState.questionnaire.items.join("\n")}`;
}

copyJSONBtn.onclick = ()=>{navigator.clipboard.writeText(JSON.stringify(researchState.questionnaire.items,null,2));alert("JSON copied");};
copyGBtn.onclick    = ()=>{navigator.clipboard.writeText(researchState.questionnaire.items.join("\n"));alert("Plain text copied");};

render();
