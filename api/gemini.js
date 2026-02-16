// api/gemini.js - FINAL VERSION (Synced with index.html)

export default async function handler(req, res) {
  // 🔥 1. CORS Headers (Browser connection ke liye zaroori)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight check (Browser server check karta hai)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Sirf POST request allow karo
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mode, contents, systemInstruction, prompt } = req.body;

    // ==========================================
    // 🧠 MODE 1: TEXT / CHAT / SWADHYAY (SambaNova - Llama 3.1)
    // ==========================================
    if (mode === 'text') {
      const apiKey = process.env.SAMBANOVA_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'Server Config Error: SAMBANOVA_KEY missing' });
      }

      // 1. SYSTEM PROMPT LOGIC (Dimag nikalna)
      // Chat aur SmartClass mein 'systemInstruction' alag se aata hai.
      let finalSystemPrompt = "You are a helpful AI tutor.";
      
      if (systemInstruction && systemInstruction.parts && systemInstruction.parts[0]) {
        finalSystemPrompt = systemInstruction.parts[0].text;
      }

      // 2. USER MESSAGE EXTRACTION (Sawal nikalna)
      // Swadhyay mein instruction isi ke andar mixed hai, jo Llama 3 samajh lega.
      let userMessage = "";
      if (contents && contents[0] && contents[0].parts) {
         // Saare text parts ko jod do
         userMessage = contents[0].parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
      }

      if (!userMessage) {
        return res.status(400).json({ error: 'Empty message received.' });
      }

      // 3. CALL SAMBANOVA (Llama 3.1)
      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-8B-Instruct", // Free & Powerful Model
          messages: [
            // System Prompt sabse upar (Logic Control)
            { role: "system", content: finalSystemPrompt },
            // User Message (Question)
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1500 // Bade answers (Solutions) ke liye zaroori
        })
      });

      const data = await response.json();

      // Error Handling
      if (!response.ok) {
        console.error("SambaNova Error:", data);
        return res.status(500).json({ error: "AI Busy. Please try again." });
      }

      const replyText = data.choices?.[0]?.message?.content;
      
      if (replyText) {
        return res.status(200).json({ text: replyText });
      } else {
        return res.status(200).json({ error: "No response content." });
      }
    }

    // ==========================================
    // 🎨 MODE 2: IMAGE GENERATION (Pollinations AI)
    // ==========================================
    if (mode === 'image') {
      const encodedPrompt = encodeURIComponent(prompt || "education");
      // Random seed taaki har baar alag image bane
      const randomSeed = Math.floor(Math.random() * 10000);
      
      // Direct URL generation (Backend call ki zarurat nahi, secure URL bhej rahe hain)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;

      return res.status(200).json({ image: imageUrl });
    }

    // ==========================================
    // 🎤 MODE 3: TTS FALLBACK
    // ==========================================
    if (mode === 'tts') {
       // HTML mein fallbackTTS function hai, hum bas signal bhejenge ki browser use karo.
       return res.status(200).json({ error: "TTS_FALLBACK" });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
