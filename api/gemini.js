export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { contents, persona } = req.body;

    // Frontend se aaya hua user text nikaalo
    const userMessage =
      contents?.[0]?.parts?.[0]?.text || "";

    if (!userMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    // System prompt (PadhaiSetu style)
    const systemPrompt = `
You are "${persona || "Badi Didi"}" from PadhaiSetu.
You teach Indian students in simple Hindi/Hinglish.
Be caring, motivating, and step-by-step.
Never sound robotic.
If the student is confused, first comfort them, then explain.
    `.trim();

    // 🔥 1min.ai API call
    const response = await fetch("https://api.1min.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.ONEMIN_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini", // fast + powerful
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    });

    const data = await response.json();

    const text =
      data?.choices?.[0]?.message?.content ||
      "Mujhe abhi jawab nahi mila, thoda dobara poochho 😊";

    // Gemini-style response format (tumhare frontend ke liye)
    res.status(200).json({
      candidates: [
        {
          content: {
            parts: [{ text }]
          }
        }
      ]
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      candidates: [
        {
          content: {
            parts: [{ text: "Server error ho gaya 😓" }]
          }
        }
      ]
    });
  }
}
