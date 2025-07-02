// =============================
//  Survey Builder – FULL app.js  (Discussion area now GPT chat)
//  Updated: 2025‑07‑02
//  ────────────────────────────────────────────────────────────
//  • Generates questionnaire (PROFILE / YESNO / LIKERT)
//  • Discussion panel is now a live ChatGPT thread – students can talk to the
//    assistant about the draft.  Each user message triggers a GPT response
//    that is appended to the log.
//  • Regeneration still feeds Intro + PrevWorks + Methods + ENTIRE discussion
//    to create a fresh draft.
// =============================

/*****   GLOBAL APP STATE   *****/
const researchState = {
  intro: "",
  previous: "",
  methods: "",
  draftCount: 0,
  questionnaire: { profile: [], yesno: [], likert: [] }
};

/*****   DOM REFERENCES   *****/
const introInput     = document.getElementById("intro-input");
const prevInput      = document.getElementById("prevworks-input");
const methodsInput   = document.getElementById("methods-input");
const genBtn         = document.getElementById("generate-q-btn");
const sendDraftBtn   = document.getElementById("send-draft-btn");
const regenBtn       = document.getElementById("regen-q-btn");
const profileList    = document.getElementById("profile-list");
const yesnoList      = document.getElementById("yesno-list");
const constructsBox  = document.getElementById("constructs-list");
const discussionBox  = document.getElementById("discussion-log");
const commentInput   = document.getElementById("comment-input");
const addCommentBtn  = document.getElementById("add-comment-btn");
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
    await generateQuestionnaire("");
  } catch (err) { alert(err.message); }
  genBtn.disabled = false; genBtn.textContent = "Generate Questionnaire";
});

/*****   SEND CURRENT DRAFT TO DISCUSSION LOG   *****/
sendDraftBtn.addEventListener("click", () => {
  if (!hasDraft()) { alert("No questionnaire to send."); return; }
  pushCurrentDraftToDiscussion();
});

/*****   GPT CHAT IN DISCUSSION AREA   *****/
addCommentBtn.addEventListener("click", async () => {
  const userMsg = commentInput.value.trim();
  if (!userMsg) return;
  // append user message
  discussionBox.value += `\n\nYou: ${userMsg}`;
  commentInput.value = "";

  try {
    const assistantReply = await callGPT([
      { role: "system", content: `You are ChatGPT helping students refine a questionnaire for their undergraduate thesis. Use the provided draft items as context and give clear, concise feedback or suggestions.` },
      { role: "user", content: buildPromptForChat(userMsg) }
    ], 0.7);

    discussionBox.value += `\nAI: ${assistantReply}`;
    // auto‑scroll to bottom
    discussionBox.scrollTop = discussionBox.scrollHeight;
  } catch (err) {
    alert("Chat error: " + err.message);
  }
});

function buildPromptForChat(latestUserMsg) {
  return `Current draft items:\n${plainQuestions()}\n\nPrevious discussion:\n${discussionBox.value}\n\nUser: ${latestUserMsg}`;
}

/*****   REGENERATE USING DISCUSSION   *****/
regenBtn.addEventListener("click", async () => {
  if (!sourcesFilled()) return;
  if (hasDraft()) pushCurrentDraftToDiscussion();
  regenBtn.disabled = true; regenBtn.textContent = "Regenerating…";
  try {
    await generateQuestionnaire(discussionBox.value);
  } catch (err) { alert(err.message); }
  regenBtn.disabled = false; regenBtn.textContent = "Regenerate Questionnaire";
});

/*****   GENERATE / REGENERATE FUNCTION   *****/
async function generateQuestionnaire(extraContext) {
  const systemPrompt = `You are an educational survey designer. Using the INTRODUCTION, PREVIOUS WORKS, METHODS, and DISCUSSION below, draft 10–15 questionnaire items. Label each line with PROFILE:, YESNO:, or LIKERT:.`;
  const userPrompt = `INTRODUCTION:\n${researchState.intro}\n\nPREVIOUS WORKS:\n${researchState.previous}\n\nMETHODS:\n${researchState.methods}\n\nDISCUSSION:\n${extraContext || "(none)"}`;

  const raw = await callGPT([
    { role: "system", content: systemPrompt },
    { role: "user",   content: userPrompt   }
  ]);

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
  profileList.innerHTML = "";
  researchState.questionnaire.profile.forEach(txt => {
    const li = document.createElement("li"); li.textContent = txt; profileList.appendChild(li);
  });

  yesnoList.innerHTML = "";
  researchState.questionnaire.yesno.forEach(txt => {
    const li = document.createElement("li"); li.textContent = txt; yesnoList.appendChild(li);
  });

  constructsBox.innerHTML = "";
  researchState.questionnaire.likert.forEach(obj => {
    const row = document.createElement("div"); row.className = "item-row";
    const pol = document.createElement("button"); pol.textContent = obj.polarity===1?"👍":"👎";
    pol.onclick = () => { obj.polarity*=-1; renderQuestionnaire(); };
    const input = document.createElement("input"); input.value = obj.text;
    input.onchange = () => { obj.text = input.value; };
    row.append(pol, input);
    constructsBox.appendChild(row);
  });
}

/*****   DISCUSSION HELPERS   *****/
function pushCurrentDraftToDiscussion() {
  if (!hasDraft()) return;
  const d = researchState.questionnaire;
  const block = `\n\n— Draft #${researchState.draftCount} —\nPROFILE: ${d.profile.join(" | ")}\nYESNO: ${d.yesno.join(" | ")}\nLIKERT: ${d.likert.map(o=>o.text).join(" | ")}`;
  discussionBox.value += block;
}
function hasDraft() {
  const q = researchState.questionnaire;
  return q.profile.length || q.yesno.length || q.likert.length;
}
function sourcesFilled() {
  if (!researchState.intro || !researchState.previous || !researchState.methods) {
    alert("Please fill Introduction, Previous Works, and Methods first.");
    return false;
  }
  return true;
}
function plainQuestions() {
  const q = researchState.questionnaire;
  return [
    ...q.profile.map(p => `PROFILE: ${p}`),
    ...q.yesno.map(y => `YESNO: ${y}`),
    ...q.likert.map(l => `LIKERT: ${l.text}`)
  ].join("\n");
}

/*****   EXPORT BUTTONS   *****/
copyJsonBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(JSON.stringify(researchState.questionnaire, null, 2));
  alert("Questionnaire JSON copied ✨");
});
copyScriptBtn.addEventListener("click", () => {
  navigator
