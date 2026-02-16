// api/gemini.js - FINAL HYBRID VERSION (SambaNova + Pollinations)

export default async function handler(req, res) {
  // 🔥 1. CORS HEADERS (Zaroori hai taaki 'Network Error' na aaye)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle Preflight Request (Browser check karta hai server zinda hai ya nahi)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mode, contents, systemInstruction, prompt } = req.body;

  // --- 2. TEXT MODE (SambaNova - Llama 3.1) ---
  if (mode === 'text') {
    try {
      const apiKey = process.env.SAMBANOVA_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'Server Config Error: Missing SAMBANOVA_KEY' });
      }

      // A. Extract System Prompt from Frontend
      let systemPrompt = "You are a helpful assistant.";
      if (systemInstruction && systemInstruction.parts && systemInstruction.parts[0]) {
        systemPrompt = systemInstruction.parts[0].text;
      }

      // B. Extract User Message (Parsing Google Format)
      let userMessage = "";
      if (contents && contents[0] && contents[0].parts) {
         userMessage = contents[0].parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
      }

      if (!userMessage) {
        return res.status(400).json({ error: 'No text content provided.' });
      }

      // C. Call SambaNova API
      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-8B-Instruct", // Fast & Free
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          top_p: 0.9
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("SambaNova Error:", data);
        return res.status(500).json({ error: "AI Busy. Please try again." });
      }

      const replyText = data.choices?.[0]?.message?.content || "No response.";
      
      return res.status(200).json({ text: replyText });

    } catch (error) {
      console.error("Backend Text Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // --- 3. IMAGE MODE (Pollinations AI - Free) ---
  if (mode === 'image') {
    try {
      if (!prompt) {
        return res.status(400).json({ error: "Prompt required for image generation" });
      }

      // Encode prompt for URL
      const encodedPrompt = encodeURIComponent(prompt);
      
      // Random seed taaki har baar nayi image bane
      const randomSeed = Math.floor(Math.random() * 1000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;

      // Return URL directly
      return res.status(200).json({ image: imageUrl });

    } catch (error) {
       console.error("Backend Image Error:", error);
       return res.status(500).json({ error: "Image Generation Failed" });
    }
  }

  // --- 4. TTS MODE (Fallback) ---
  if (mode === 'tts') {
     // Frontend ko signal do ki Browser ki awaaz use kare (Free & Fast)
     return res.status(200).json({ error: "TTS_FALLBACK" });
  }

  return res.status(400).json({ error: 'Invalid mode' });
        }
