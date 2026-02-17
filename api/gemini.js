export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { mode = "text", contents, systemInstruction } = req.body;

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: "Gemini API key missing" });
    }

    // -------- TEXT CHAT --------
    if (mode === "text") {
      const userText =
        contents?.[0]?.parts?.map(p => p.text).join("\n") || "";

      const systemPrompt =
        systemInstruction?.parts?.[0]?.text ||
        "You are a helpful Indian study mentor.";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: systemPrompt + "\n\n" + userText }] }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      const data = await response.json();

      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "⚠️ No response from Gemini";

      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("GEMINI ERROR:", err);
    return res.status(500).json({ error: "Gemini server error" });
  }
}
