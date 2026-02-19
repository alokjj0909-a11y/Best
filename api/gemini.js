// api/gemini.js
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction, prompt } = req.body;

    // ---------- IMAGE GENERATION (Pollinations Flux) ----------
    if (mode === 'image') {
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
      return res.status(200).json({ image: imageUrl });
    }

    // ---------- TTS (frontend uses browser TTS) ----------
    if (mode === 'tts') {
      return res.status(200).json({ text: null, audio: null });
    }

    // ---------- TEXT (Chat / Swadhyay) ----------
    if (mode === 'text') {
      const hasImage = contents[0]?.parts?.some(part => part.inlineData);
      const geminiKey = process.env.GEMINI_API_KEY;

      // Agar image hai aur Gemini key available hai → Gemini Vision
      if (hasImage && geminiKey) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

        const geminiContents = [{
          parts: contents[0].parts.map(part => {
            if (part.text) return { text: part.text };
            if (part.inlineData) return {
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
              }
            };
          })
        }];

        const requestBody = { contents: geminiContents };
        if (systemInstruction?.parts?.[0]?.text) {
          requestBody.systemInstruction = { parts: [{ text: systemInstruction.parts[0].text }] };
        }

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gemini error');
        const replyText = data.candidates[0].content.parts[0].text;
        return res.status(200).json({ text: replyText });
      }

      // Nahi to Pollinations text‑only
      const userText = contents[0].parts.map(p => p.text || '').join('\n');
      const sysPrompt = systemInstruction?.parts?.[0]?.text ||
        "You are PadhaiSetu, a helpful human-like AI tutor. Reply in the same language as the user.";

      const pollinationsResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userText }
          ],
          model: 'openai',
          seed: Math.floor(Math.random() * 1000)
        })
      });

      if (!pollinationsResponse.ok) throw new Error("Pollinations error");
      const replyText = await pollinationsResponse.text();
      return res.status(200).json({ text: replyText });
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Kuch gadbad ho gayi hai." });
  }
}
