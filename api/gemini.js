// api/gemini.js - UNSTOPPABLE BACKEND (405B -> 70B -> 8B Fallback)

export default async function handler(req, res) {
  // 1. CORS Headers (Zaroori)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction, prompt } = req.body;

    // =======================================================
    // 🧠 SMART TEXT MODE (Cascading Fallback System)
    // =======================================================
    if (mode === 'text') {
      const apiKey = process.env.SAMBANOVA_KEY;
      if (!apiKey) return res.status(500).json({ error: 'Configuration Error: SAMBANOVA_KEY missing in Vercel Settings.' });

      // 1. Prepare Messages
      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;

      let userMessage = "";
      if (contents?.[0]?.parts) {
         userMessage = contents[0].parts.map(p => p.text).filter(t => t).join('\n');
      }
      if (!userMessage) return res.status(400).json({ error: 'Empty message received.' });

      const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage }
      ];

      // 🔥 HELPER FUNCTION: Call SambaNova with Timeout
      const callAI = async (modelName, timeoutMs = 9000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
            const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 1500
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
      };

      // 🚀 EXECUTION STRATEGY (Fallback Logic)
      try {
          // Attempt 1: The Beast (405B) - Best Quality
          console.log("Attempting 405B...");
          const text405 = await callAI("Meta-Llama-3.1-405B-Instruct", 8000); // 8 sec timeout
          if (text405) return res.status(200).json({ text: text405 });
      
      } catch (err405) {
          console.error("405B Failed/Timeout, switching to 70B...", err405.message);
          
          try {
              // Attempt 2: The Smart Speedster (70B)
              const text70 = await callAI("Meta-Llama-3.3-70B-Instruct", 8000);
              if (text70) return res.status(200).json({ text: text70 });
          
          } catch (err70) {
              console.error("70B Failed, switching to 8B...", err70.message);
              
              try {
                  // Attempt 3: The Rocket (8B) - Fastest
                  const text8 = await callAI("Meta-Llama-3.1-8B-Instruct", 5000);
                  if (text8) return res.status(200).json({ text: text8 });
              } catch (err8) {
                  // If everything fails, show the REAL error
                  return res.status(500).json({ error: `All models failed. Last error: ${err8.message}` });
              }
          }
      }
      return res.status(500).json({ error: "AI gave no response." });
    }

    // =======================================================
    // 🎨 IMAGE MODE (Unchanged)
    // =======================================================
    if (mode === 'image') {
      const encodedPrompt = encodeURIComponent(prompt || "education");
      const randomSeed = Math.floor(Math.random() * 10000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;
      return res.status(200).json({ image: imageUrl });
    }

    // =======================================================
    // 🎤 TTS MODE (Fallback)
    // =======================================================
    if (mode === 'tts') return res.status(200).json({ error: "TTS_FALLBACK" });

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical Server Error:", error);
    // 🔥 Return ACTUAL Error message to UI for debugging
    return res.status(500).json({ error: `Server Crash: ${error.message}` });
  }
                                                     }
         
