// api/gemini.js - FINAL 405B POWERED BACKEND (Translator Logic Included)

export default async function handler(req, res) {
  // 🔥 1. CORS Headers (Security & Connection)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight check
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mode, contents, systemInstruction, prompt } = req.body;

    // ==========================================
    // 🧠 MODE 1: TEXT / CHAT (SambaNova - Llama 3.1 405B)
    // ==========================================
    if (mode === 'text') {
      const apiKey = process.env.SAMBANOVA_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'Server Config Error: SAMBANOVA_KEY missing' });
      }

      // 1. SYSTEM PROMPT EXTRACTION (HTML se data nikalna)
      // HTML bhej raha hai: systemInstruction.parts[0].text
      let finalSystemPrompt = "You are a helpful AI tutor.";
      
      if (systemInstruction && systemInstruction.parts && systemInstruction.parts[0]) {
        finalSystemPrompt = systemInstruction.parts[0].text;
      }

      // 2. USER MESSAGE EXTRACTION (HTML se data nikalna)
      // HTML bhej raha hai: contents[0].parts[0].text
      let userMessage = "";
      if (contents && contents[0] && contents[0].parts) {
         // Saare parts ko jod kar ek message banana
         userMessage = contents[0].parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
      }

      if (!userMessage) {
        return res.status(400).json({ error: 'Empty message received.' });
      }

      // 3. CALL SAMBANOVA (Llama Format mein Convert karke bhejna)
      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-405B-Instruct", // 🔥 Beast Mode 405B
          messages: [
            // Yahan humne convert kar diya: { role: "system" }
            { role: "system", content: finalSystemPrompt },
            // Aur yahan user message: { role: "user" }
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        })
      });

      const data = await response.json();

      // Error Handling
      if (!response.ok) {
        console.error("SambaNova Error:", data);
        return res.status(500).json({ error: "AI is busy (High Traffic). Please try again." });
      }

      const replyText = data.choices?.[0]?.message?.content;
      
      if (replyText) {
        return res.status(200).json({ text: replyText });
      } else {
        return res.status(200).json({ error: "No response from AI." });
      }
    }

    // ==========================================
    // 🎨 MODE 2: IMAGE GENERATION (Pollinations AI)
    // ==========================================
    if (mode === 'image') {
      const encodedPrompt = encodeURIComponent(prompt || "education");
      const randomSeed = Math.floor(Math.random() * 10000);
      
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;

      return res.status(200).json({ image: imageUrl });
    }

    // ==========================================
    // 🎤 MODE 3: TTS FALLBACK
    // ==========================================
    if (mode === 'tts') {
       return res.status(200).json({ error: "TTS_FALLBACK" });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
  }
           
