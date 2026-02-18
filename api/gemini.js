export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  try {
    const { message, persona } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ text: "No message provided" });
    }

    // 🎭 Persona system prompt
    const systemPrompt =
      persona === "Badi Didi"
        ? "Tum ek caring badi didi ho jo students ko simple Hindi/Hinglish me padhati ho."
        : "Tum ek helpful study assistant ho.";

    // 🧠 MODEL SELECT (fast + free-friendly)
    const MODEL = "google/gemini-2.5-flash-lite";
    // 👉 baad me change kar sakta hai:
    // "qwen/qwen2.5-7b"
    // "mistral/mistral-small"
    // "openai/gpt-4o-mini"

    const response = await fetch(
      "https://api.pollinations.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.POLLINATIONS_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.6,
          max_tokens: 500
        })
      }
    );

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content ||
      "Abhi jawab nahi mila 😓";

    return res.status(200).json({ text });

  } catch (error) {
    console.error("Pollinations Error:", error);
    return res.status(500).json({
      text: "Model load ho raha hai, 5–10 sec baad try karo 🙂"
    });
  }
}
