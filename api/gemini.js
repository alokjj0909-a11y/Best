// api/gemini.js - Pure Pollinations Backend
// No hardcoded Gemini models - only Pollinations

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction, prompt } = req.body;

    // ---------- IMAGE GENERATION (Pollinations Flux) ----------
    if (mode === 'image') {
      // Frontend already uses direct URL, but if called, return URL
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
      return res.status(200).json({ image: imageUrl });
    }

    // ---------- TTS (Not supported - frontend uses browser TTS) ----------
    if (mode === 'tts') {
      return res.status(200).json({ text: null, audio: null });
    }

    // ---------- TEXT (Chat / Swadhyay) ----------
    if (mode === 'text') {
      // Check if image is present
      const hasInlineData = contents[0]?.parts?.some(part => part.inlineData);
      
      let userText = "";
      let imageData = null;
      
      // Extract text and image from parts
      for (const part of contents[0].parts) {
        if (part.text) {
          userText += part.text + "\n";
        } else if (part.inlineData) {
          imageData = part.inlineData.data;
        }
      }
      
      // Build system prompt
      let sysPrompt = "You are PadhaiSetu, a helpful human-like AI tutor. Reply in the same language as the user.";
      if (systemInstruction?.parts?.[0]?.text) {
        sysPrompt = systemInstruction.parts[0].text;
      }
      
      // For images, add note that we're processing
      let finalUserText = userText;
      if (hasInlineData) {
        finalUserText = "[IMAGE UPLOADED] " + userText + "\n\nPlease analyze this image if it contains educational content or a question paper. If it's a question paper, solve it completely following the format rules.";
      }
      
      // Call Pollinations
      const pollinationsResponse = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: finalUserText.trim() }
          ],
          model: 'openai',
          seed: Math.floor(Math.random() * 1000)
        })
      });
      
      if (!pollinationsResponse.ok) {
        const errorText = await pollinationsResponse.text();
        throw new Error(`Pollinations error: ${errorText}`);
      }
      
      const replyText = await pollinationsResponse.text();
      return res.status(200).json({ text: replyText });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Kuch gadbad ho gayi hai. Please try again." });
  }
      }
