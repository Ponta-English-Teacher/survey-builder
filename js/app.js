// =============================
//  Survey Builder – FULL app.js  (with Discussion & Regeneration)
//  Updated: 2025‑06‑30
//  ────────────────────────────────────────────────────────────
//  • Three source textareas: Introduction, Previous Works, Methods
//  • Generate Questionnaire (PROFILE / YESNO / LIKERT)
//  • Discussion log collects every draft and user comments
//  • Regenerate button feeds GPT => Intro + PrevWorks + Methods + Discussion
//  • One‑click JSON & Google‑Forms export
//  • Works offline except POST → /api/openai proxy
// =============================

/*****   GLOBAL APP STATE   *****/
const researchState = {
  intro: "",
  previous: "",
  methods: "",
  draftCount: 0,                        // # of drafts generated so far
  questionnaire: {                      // current visible draft
    profile: [],                        // [string]
    yesno: [],                          // [string]
    likert: []                          // [{text, polarity}]
  }
};

/*****   DOM REFERENCES   *****/
// source inputs
const introInput     = document.getElementById("intro-input");
const prevInput      = document.getElementById("prevworks-input");
const methodsInput   = document.getElementById("methods-input");
// main buttons
const genBtn         = document.getElementById("generate-q-btn");
const sendDraftBtn   = document.getElementById("send-draft-btn");
const regenBtn       = document.getElementById("regen-q-btn");
// questionnaire containers
const profileList    = document.getElementById("profile-list");
const yesnoList      = document.getElementById("yesno-list");
const constructsBox  = document.getElementById("constructs-list");
// discussion area
const discussionBox  = document.getElementById("discussion-log");
const commentInput   = document.getElementById("comment-input");
const addCommentBtn  = document.getElementById("add-comment-btn");
// export
const copyJsonBtn    = document.getElementById("copy-json-btn");
const copyScriptBtn  = document.getElementById("copy-script-btn");

/*****   LIVE‑SYNC SOURCE FIELDS   *****/
introInput .addEventListener("input", () => researchState.intro     = introInput .value.trim());
prevInput  .addEventListener("input", () => researchState.previous  = prevInput  .value.trim());
methodsInput.addEventListener("input", () => researchState.methods = methodsInput.value.trim());

/*****   OPENAI CALL HELPER   *****/
async function callGPT(messages, temperature = 0.7, model = "gpt-4o") {
  const res = await fetch("/api/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature, model })
  });
  if (!res.ok) throw new Error("OpenAI error " + (await res.text()));
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/*****   GENERATE FIRST DRAFT   *****/
genBtn.addEventListener("click", async () => {
  if (!sourcesFilled()) return;
  genBtn.disabled = true; genBtn.textContent = "Generating…";
  try {
    await generateQuestionnaire(discussionBox.value); // no discussion for first draft
  } catch (err) { alert(err.message); }
  genBtn.disabled = false; genBtn.textContent = "Generate Questionnaire";
});

/*****   SEND CURRENT DRAFT TO DISCUSSION LOG   *****/
sendDraftBtn.addEventListener("click", () => {
  if (!hasDraft()) { alert("No questionnaire to send."); return; }
  pushCurrentDraftToDiscussion();
});

/*****   ADD USER COMMENT   *****/
addCommentBtn.addEventListener("click", () => {
  const txt = commentInput.value.trim();
  if (!txt) return;
  discussionBox.value += `\n>> Comment: ${txt}`;
  commentInput.value = "";
});

/*****   REGENERATE USING DISCUSSION   *****/
regenBtn.addEventListener("click", async () => {
  if (!sourcesFilled()) return;
  // ensure current draft is logged
  if (hasDraft()) pushCurrentDraftToDiscussion();
  regenBtn.disabled = true; regenBtn.textContent = "Regenerating…";
  try {
    await generateQuestionnaire(discussionBox.value);
  } catch (err) { alert(err.message); }
  regenBtn.disabled = false; regenBtn.textContent = "Regenerate Questionnaire";
});

/*****   GENERATE / REGENERATE FUNCTION   *****/
async function generateQuestionnaire(extraContext) {
  const systemPrompt = `You are an educational survey designer. Based on the INTRODUCTION, PREVIOUS WORKS, METHODS, and DISCUSSION below, draft 10–15 questionnaire items.\nLabel each line with PROFILE:, YESNO:, or LIKERT: (balanced polarity). No extra commentary.`;
  const userPrompt = `INTRODUCTION:\n${researchState.intro}\n\nPREVIOUS WORKS:\n${researchState.previous}\n\nMETHODS:\n${researchState.methods}\n\nDISCUSSION:\n${extraContext || "(none)"}`;

  const raw = await callGPT([
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt   }
  ]);

  // reset current draft
  researchState.questionnaire = { profile: [], yesno: [], likert: [] };
  raw.split(/\n+/).forEach((line, i) => {
    line = line.replace(/^[-*]\s*/, "").trim();
    if (!line) return;
    if (line.toUpperCase().startsWith("PROFILE:")) {
      researchState.questionnaire.profile.push(line.replace(/PROFILE:/i, "").trim());
    } else if (line.toUpperCase().startsWith("YESNO:")) {
      researchState.questionnaire.yesno.push(line.replace(/YESNO:/i, "").trim());
    } else if (line.toUpperCase().startsWith("LIKERT:")) {
      const text = line.replace(/LIKERT:/i, "").trim();
      const polarity = i % 2 === 0 ? 1 : -1;
      researchState.questionnaire.likert.push({ text, polarity });
    }
  });
  researchState.draftCount++;
  renderQuestionnaire();
}

/*****   RENDER FUNCTIONS   *****/
function renderQuestionnaire() {
  // Profile
  profileList.innerHTML = "";
  researchState.questionnaire.profile.forEach((item, idx) => {
    const li = document.createElement("li"); li.textContent = item;
    profileList.appendChild(li);
  });
  // Yes/No
  yesnoList.innerHTML = "";
  researchState.questionnaire.yesno.forEach((item, idx) => {
    const li = document.createElement("li"); li.textContent = item;
    yesnoList.appendChild(li);
  });
  // Likert
  constructsBox.innerHTML = "";
  researchState.questionnaire.likert.forEach((obj, idx) => {
    const row = document.createElement("div"); row.className = "item-row";
    const polBtn = document.createElement("button"); polBtn.textContent = obj.polarity===1?"👍":"👎";
    polBtn.onclick = () => { obj.polarity *= -1; renderQuestionnaire(); };
    const inp = document.createElement("input"); inp.value = obj.text;
    inp.onchange = () => { obj.text = inp.value; };
    row.append(polBtn, inp);
    constructsBox.appendChild(row);
  });
}

/*****   DISCUSSION HELPERS   *****/
function pushCurrentDraftToDiscussion() {
  if (!hasDraft()) return;
  const d = researchState.questionnaire;
  let block = `\n\n— Draft #${researchState.draftCount} —\nPROFILE: ${d.profile.join(" | ")}\nYESNO: ${d.yesno.join(" | ")}\nLIKERT: ${d.likert.map(o=>o.text).join(" | ")}`;
  discussionBox.value += block;
}
function hasDraft() {
  return researchState.questionnaire.profile.length || researchState.questionnaire.yesno.length || researchState.questionnaire.likert.length;
}
function sourcesFilled() {
  if (!researchState.intro || !researchState.previous || !researchState.methods) {
    alert("Please fill Introduction, Previous Works, and Methods first.");
    return false;
  }
  return true;
}

/*****   EXPORT BUTTONS   *****/
copyJsonBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(JSON.stringify(researchState.questionnaire, null, 2));
  alert("Questionnaire JSON copied ✨");
});
copyScriptBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(generateFormsScript());
  alert("Google Forms script copied ✨");
});

function generateFormsScript() {
  const q = researchState.questionnaire;
  let s = `function createForm(){\n  const f = FormApp.create('Survey Form');\n`;
  q.profile.forEach(p => { s += `  f.addTextItem().setTitle('${escapeQuotes(p)}');\n`; });
  q.yesno.forEach(y => { s += `  f.addMultipleChoiceItem().setTitle('${escapeQuotes(y)}').setChoiceValues(['Yes','No']);\n`; });
  q.likert.forEach(l => { s += `  f.addScaleItem().setTitle('${escapeQuotes(l.text)}').setBounds(1,5).setLabels('Strongly disagree','Strongly agree');\n`; });
  s += `}`;
  return s;
}
function escapeQuotes(str){return str.replace(/'/g,"\\'");}

/*****   INITIAL RENDER (empty) *****/
renderQuestionnaire();
