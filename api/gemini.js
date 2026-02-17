export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { contents, persona } = req.body;

    const userMessage =
      contents?.[0]?.parts?.[0]?.text;

    if (!userMessage) {
      return res.status(400).json({
        candidates: [
          { content: { parts: [{ text: "No input text" }] } }
        ]
      });
    }

    const systemPrompt = `
You are "${persona || "Badi Didi"}" from PadhaiSetu.
Teach Indian students in simple Hindi/Hinglish.
Be caring, motivating, step-by-step.
Never sound robotic.
`.trim();

    const response = await fetch("https://api.1min.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ONEMIN_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content ||
      "Abhi jawab nahi mila 😓";

    return res.status(200).json({
      candidates: [
        { content: { parts: [{ text }] } }
      ]
    });

  } catch (err) {
    console.error("Gemini API Error:", err);

    return res.status(500).json({
      candidates: [
        {
          content: {
            parts: [{ text: "Backend error ho gaya 😓" }]
          }
        }
      ]
    });
  }
}
