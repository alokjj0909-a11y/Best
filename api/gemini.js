// api/gemini.js - ULTRA ROBUST CASCADE (405B -> 70B -> 8B)
// Designed to beat Vercel's 10s Timeout

export const config = {
  maxDuration: 60, // Pro plan ke liye 60s, Free ke liye usually 10s hi rehta hai
};

export default async function handler(req, res) {
  // 1. CORS Headers (Browser access ke liye)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // =================================================================
    // 🎤 MODE 1: VOICE / AUDIO (Powered by Google Gemini 2.0 Flash)
    // =================================================================
    // Check if input has audio data
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    
    if (mode === 'tts' || (mode === 'text' && hasAudioInput)) {
        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return res.status(500).json({ error: 'GOOGLE_API_KEY missing in Vercel' });

        let sysPromptText = "You are a helpful tutor. Reply naturally in Hindi/English mix.";
        if (systemInstruction?.parts?.[0]?.text) sysPromptText = systemInstruction.parts[0].text;
        sysPromptText += " (Keep answers concise for voice output.)";

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: { parts: [{ text: sysPromptText }] },
                    generationConfig: {
                        temperature: 0.7,
                        responseModalities: ["AUDIO"] // 🔥 Direct Audio Response
                    }
                })
            });

            const data = await response.json();
            const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const textData = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (audioData) return res.status(200).json({ audio: audioData, text: "🎤 Voice Response" });
            if (textData) return res.status(200).json({ text: textData });
            throw new Error("Gemini Voice Failed");
        } catch (e) {
            console.error("Voice Error:", e);
            // Fallback to text mode if voice fails
        }
    }

    // =================================================================
    // 🧠 MODE 2: INTELLIGENT TEXT (Cascading Llama Models)
    // =================================================================
    if (mode === 'text') {
      const sambaKey = process.env.SAMBANOVA_KEY;
      if (!sambaKey) return res.status(500).json({ error: 'SAMBANOVA_KEY missing' });

      // 1. Prepare Prompts
      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) {
          finalSystemPrompt = systemInstruction.parts[0].text;
      }
      // 🔥 Force JSON/Table formatting rules in backend too
      finalSystemPrompt += "\n\n[SYSTEM RULE: If asked for difference/comparison, USE MARKDOWN TABLE. If math, use step-by-step.]";

      // 2. Prepare User Message
      let userMessage = contents[0].parts.map(p => p.text).join('\n');
      const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage }
      ];

      // 🔥 HELPER: Smart Fetch with Timeout
      const callSambaNova = async (modelId, timeoutMs) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          try {
              console.log(`Attempting Model: ${modelId} with timeout ${timeoutMs}ms`);
              const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                  method: "POST",
                  headers: {
                      "Authorization": `Bearer ${sambaKey}`,
                      "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                      model: modelId,
                      messages: messages,
                      temperature: 0.7,
                      top_p: 0.9,
                      max_tokens: 1500
                  }),
                  signal: controller.signal
              });
              clearTimeout(timeoutId);
              
              if (!response.ok) throw new Error(`API Status: ${response.status}`);
              const data = await response.json();
              return data.choices?.[0]?.message?.content || null;
          } catch (error) {
              clearTimeout(timeoutId);
              throw error; // Pass error to next catcher
          }
      };

      // 🚀 THE CASCADE STRATEGY (Time-Bound)
      try {
          // Attempt 1: The Beast (405B) - Timeout 6s (Strict for Vercel Free Tier)
          const text405 = await callSambaNova("Meta-Llama-3.1-405B-Instruct", 6000);
          if (text405) return res.status(200).json({ text: text405 });

      } catch (err405) {
          console.warn("⚠️ 405B Failed/Timeout. Switching to 70B...", err405.name);
          
          try {
              // Attempt 2: The Genius (70B) - Timeout 5s (Faster fallback)
              // 70B is almost as smart as GPT-4 but much faster than 405B
              const text70 = await callSambaNova("Meta-Llama-3.3-70B-Instruct", 5000);
              if (text70) return res.status(200).json({ text: text70 });

          } catch (err70) {
              console.warn("⚠️ 70B Failed. Switching to 8B...", err70.name);
              
              try {
                  // Attempt 3: The Flash (8B) - Timeout 3s (Last Resort)
                  const text8 = await callSambaNova("Meta-Llama-3.1-8B-Instruct", 4000);
                  if (text8) return res.status(200).json({ text: text8 });
                  
              } catch (err8) {
                  return res.status(500).json({ error: "All AI models are busy. Please try again in 5 seconds." });
              }
          }
      }
    }

    // =================================================================
    // 🎨 MODE 3: IMAGE GENERATION
    // =================================================================
    if (mode === 'image') {
      const promptText = req.body.prompt || "education";
      const encodedPrompt = encodeURIComponent(promptText);
      const randomSeed = Math.floor(Math.random() * 10000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;
      return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
  }
    
