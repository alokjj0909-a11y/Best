// api/gemini.js - POWERFUL VOICE & INTELLIGENT CHAT BACKEND

export const config = {
  maxDuration: 60, // Voice processing needs time
};

export default async function handler(req, res) {
  // 1. CORS Headers (Allow browser connection)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // =================================================================
    // 🎤 MODE 1: VOICE / AUDIO (Human-Like Conversation)
    // Uses Google Gemini 2.0 Flash (Stable)
    // =================================================================
    
    // Check if the user sent Audio input OR requested TTS (Text-to-Speech)
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        const googleKey = process.env.GOOGLE_API_KEY;
        if (!googleKey) return res.status(500).json({ error: 'GOOGLE_API_KEY missing in Vercel Settings' });

        // 🧠 System Prompt for Voice
        let sysPromptText = "You are PadhaiSetu, a friendly and energetic Indian tutor.";
        if (systemInstruction?.parts?.[0]?.text) {
            sysPromptText = systemInstruction.parts[0].text;
        }
        // Strict Voice Instructions
        sysPromptText += " (IMPORTANT: Reply in a natural, human-like voice. Use mixed Hindi-English (Hinglish) if the user speaks it. Keep answers concise and conversational. Do not read out markdown symbols like asterisks.)";

        try {
            // 🔥 Using the STABLE Gemini 2.0 Flash model
            const modelName = "gemini-2.0-flash"; 
            
            console.log(`🎤 Calling Voice Model: ${modelName}`);
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents, // User's Audio or Text
                    systemInstruction: { parts: [{ text: sysPromptText }] },
                    generationConfig: {
                        temperature: 0.9, // Higher temperature for more natural speech
                        responseModalities: ["AUDIO"] // 🔥 Force Direct Audio Response
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Google API Error: ${errText}`);
            }

            const data = await response.json();
            
            // Extract Audio Data
            const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            
            if (audioData) {
                // Success! Send audio back to frontend
                return res.status(200).json({ audio: audioData, text: "🎤 Voice Response" });
            } else {
                throw new Error("No audio returned from Gemini");
            }

        } catch (e) {
            console.error("Voice Mode Error:", e.message);
            // Fallback: If 2.0 Flash fails, try 1.5 Flash (Backup)
            try {
                console.log("🔄 Trying Backup Model: gemini-1.5-flash");
                const backupResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: contents,
                        systemInstruction: { parts: [{ text: sysPromptText }] },
                        generationConfig: { responseModalities: ["AUDIO"] }
                    })
                });
                const backupData = await backupResponse.json();
                const backupAudio = backupData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (backupAudio) return res.status(200).json({ audio: backupAudio });
            } catch (backupErr) {
                return res.status(500).json({ error: "Voice service unavailable. Please use text mode." });
            }
        }
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Deep Thinking)
    // Uses Llama 405B -> 70B -> 8B Cascade
    // =================================================================
    if (mode === 'text') {
      const sambaKey = process.env.SAMBANOVA_KEY;
      if (!sambaKey) return res.status(500).json({ error: 'SAMBANOVA_KEY missing' });

      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;
      
      // Strict Formatting Rules for Text Mode
      finalSystemPrompt += "\n\n[SYSTEM RULE: If asked for difference/comparison, USE MARKDOWN TABLE. If math/physics, use step-by-step logic.]";

      let userMessage = contents[0].parts.map(p => p.text).join('\n');
      const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage }
      ];

      // Helper for Llama Calls
      const callSambaNova = async (modelId, timeoutMs) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          try {
              const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${sambaKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: modelId, messages: messages, temperature: 0.7, top_p: 0.9, max_tokens: 1500 }),
                  signal: controller.signal
              });
              clearTimeout(timeoutId);
              if (!response.ok) throw new Error(`API Status: ${response.status}`);
              const data = await response.json();
              return data.choices?.[0]?.message?.content || null;
          } catch (error) { clearTimeout(timeoutId); throw error; }
      };

      try {
          // 1. Try 405B (The Beast) - 6s Timeout
          const text405 = await callSambaNova("Meta-Llama-3.1-405B-Instruct", 6000);
          if (text405) return res.status(200).json({ text: text405 });
      } catch (err405) {
          console.warn("405B busy, switching to 70B...");
          try {
              // 2. Try 70B (The Genius) - 5s Timeout
              const text70 = await callSambaNova("Meta-Llama-3.3-70B-Instruct", 5000);
              if (text70) return res.status(200).json({ text: text70 });
          } catch (err70) {
              try {
                  // 3. Try 8B (The Rocket) - 4s Timeout
                  const text8 = await callSambaNova("Meta-Llama-3.1-8B-Instruct", 4000);
                  if (text8) return res.status(200).json({ text: text8 });
              } catch (e) { return res.status(500).json({ error: "AI is currently overloaded. Please try again." }); }
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
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
        }
                
