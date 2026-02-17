export const config = {
  maxDuration: 60,
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { contents, systemInstruction } = req.body;

    // 🔐 API KEY FROM VERCEL ENV
    const RAPID_API_KEY = process.env.RAPID_API_KEY;
    if (!RAPID_API_KEY) {
      return res.status(500).json({ error: "RapidAPI key missing" });
    }

    // 🧠 USER MESSAGE
    const userText =
      contents?.[0]?.parts?.map(p => p.text).join("\n") || "Hello";

    // 🧑‍🏫 SYSTEM / PERSONA PROMPT
    const systemPrompt =
      systemInstruction?.parts?.[0]?.text ||
      "You are a helpful Indian study mentor.";

    // 🔁 RAPIDAPI CALL (same format as you showed)
    const response = await fetch(
      "https://chatgpt-42.p.rapidapi.com/gpt4",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText }
          ],
          web_access: false
        }),
      }
    );

    const data = await response.json();

    // 🧾 RESPONSE PARSING (RapidAPI inconsistent hota hai)
    const text =
      data?.result ||
      data?.response ||
      data?.choices?.[0]?.message?.content ||
      data?.message ||
      "⚠️ No response from RapidAPI model";

    return res.status(200).json({ text });

  } catch (err) {
    console.error("RapidAPI ERROR:", err);
    return res.status(500).json({ error: "RapidAPI server error" });
  }
}
