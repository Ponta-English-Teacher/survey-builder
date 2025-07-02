kimport fetch from "node-fetch";

export default async function handler(req, res) {
  const { messages, model = "gpt-4o", temperature = 0.7 } = req.body;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });

  if (!openaiRes.ok) {
    return res.status(openaiRes.status).json({ error: await openaiRes.text() });
  }

  const data = await openaiRes.json();
  res.status(200).json(data);
}

