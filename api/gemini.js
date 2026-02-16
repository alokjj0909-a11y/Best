// api/gemini.js - HYBRID FREE VERSION
// Chat: SambaNova (Llama 3.1) | Images: Pollinations.ai (Flux)

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { mode, contents, prompt, systemInstruction } = req.body;

    // ==========================================
    // 🎨 MODE: IMAGE GENERATION (Pollinations AI)
    // ==========================================
    // Iske liye kisi API Key ki zarurat nahi hai!
    if (mode === 'image') {
      const finalPrompt = prompt || "Educational diagram";
      // Pollinations URL generate karte hain (Random seed ke sath taki har baar nayi image aaye)
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
      
      // Seedha URL bhej rahe hain (Frontend ise dikha dega)
      return res.status(200).json({ image: imageUrl });
    }

    // ==========================================
    // 🎤 MODE: TTS (Audio Fallback)
    // ==========================================
    else if (mode === 'tts') {
        // SambaNova TTS support nahi karta, isliye Browser Voice use karenge
        return res.status(400).json({ error: "Use Browser TTS" });
    }

    // ==========================================
    // 💬 MODE: TEXT & VISION (SambaNova)
    // ==========================================
    else {
      const apiKey = process.env.SAMBANOVA_KEY;
      if (!apiKey) return res.status(500).json({ error: "Server Error: SAMBANOVA_KEY missing" });

      // 1. Data Prepare karo
      let userText = "";
      let messages = [];

      // System Prompt (Agar hai)
      if (systemInstruction?.parts?.[0]?.text) {
          messages.push({ role: "system", content: systemInstruction.parts[0].text });
      } else {
          messages.push({ role: "system", content: "You are PadhaiSetu, a helpful teacher." });
      }

      // User Input Process karo
      const parts = contents?.[0]?.parts || [];
      parts.forEach(p => {
          if (p.text) userText += p.text + " ";
      });

      // Vision Support (Agar image hai) - Note: SambaNova Vision Model alag hai
      // Abhi ke liye hum Text-Only Model use karenge jo sabse stable hai.
      // Vision ke liye hum "Llama-3.2-11B-Vision-Instruct" try kar sakte hain par wo complex hai.
      // Student project ke liye Text Model best hai.
      
      messages.push({ role: "user", content: userText || "Hello" });

      // 2. Call SambaNova API
      const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-8B-Instruct", // Super Fast & Free
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("SambaNova Error:", data);
        return res.status(200).json({ error: "AI Error: " + (data.error?.message || "Unknown") });
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        return res.status(200).json({ text: aiText });
      } else {
        return res.status(200).json({ error: "No response from AI" });
      }
    }

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "Server Error: " + error.message });
  }
}
