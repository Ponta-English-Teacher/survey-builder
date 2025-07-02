// api/openai.js    ← keep exactly this path

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).end("Method Not Allowed");

  const { messages, temperature = 0.7, model = "gpt-4o" } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).end("Missing OPENAI_API_KEY");

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature })
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).end(err);
    }

    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).end(err.message);
  }
}
