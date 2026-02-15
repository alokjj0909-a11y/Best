export default async function handler(req, res) {
  // ===============================
  // 1. CORS
  // ===============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    // ===============================
    // 2. OPENROUTER API KEY
    // ===============================
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      console.error("Missing API Key");
      return res.status(500).json({ ok: false, text: "Backend Config Error: Missing API Key" });
    }

    // ===============================
    // 3. PAYLOAD PARSING (Robust)
    // ===============================
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = 'text', contents, systemInstruction, prompt } = body;

    // ===============================
    // 4. MODE HANDLING
    // ===============================

    // --- CASE A: IMAGE GENERATION (Free Fallback via Pollinations) ---
    if (mode === 'image') {
      const imgPrompt = prompt || (contents?.[0]?.parts?.[0]?.text) || "Educational Diagram";
      const encodedPrompt = encodeURIComponent(imgPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
      
      try {
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) throw new Error("Image Gen Failed");
        const arrayBuffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return res.status(200).json({
          ok: true,
          text: "Image Generated",
          image: `data:image/jpeg;base64,${base64}`,
          audio: null
        });
      } catch (err) {
        console.error("Image Gen Error:", err);
        return res.status(200).json({ ok: false, text: "Image generation failed. Please try text mode." });
      }
    }

    // --- CASE B: TTS (Force Browser Fallback) ---
    if (mode === 'tts') {
      // We explicitly return audio: null to trigger the robust window.speechSynthesis fallback in frontend.
      // This ensures 100% voice reliability without requiring paid server-side TTS keys.
      return res.status(200).json({
        ok: true,
        text: "Using Browser TTS",
        image: null,
        audio: null 
      });
    }

    // --- CASE C: TEXT / CHAT (OpenRouter) ---
    // 1. Construct System Prompt
    const messages = [];
    if (systemInstruction?.parts?.[0]?.text) {
      messages.push({ role: "system", content: systemInstruction.parts[0].text });
    } else {
      messages.push({ role: "system", content: "You are PadhaiSetu, a helpful Indian education AI." });
    }

    // 2. Flatten User Content (Handle Google format -> OpenAI format)
    let userText = "";
    let hasImage = false;
    let imageUrl = null; // Basic support for 1 image

    if (Array.isArray(contents)) {
      contents.forEach(content => {
        if (content.parts) {
          content.parts.forEach(part => {
            if (part.text) userText += part.text + "\n";
            if (part.inlineData) {
               hasImage = true;
               // OpenRouter expects data URI for vision
               imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
          });
        }
      });
    }

    // 3. Build Final Message
    const userMessageContent = [];
    if (userText) userMessageContent.push({ type: "text", text: userText });
    if (hasImage && imageUrl) userMessageContent.push({ type: "image_url", image_url: { url: imageUrl } });

    // OpenRouter simple format if no image, complex if image
    if (!hasImage) {
        messages.push({ role: "user", content: userText || "Hello" });
    } else {
        messages.push({ role: "user", content: userMessageContent });
    }

    // 4. Select Model (Vision capable for "Solve Paper")
    // google/gemini-2.0-flash-lite-preview-02-05:free is a good free vision model
    // deepseek/deepseek-r1:free for pure text
    const MODEL = hasImage 
        ? "google/gemini-2.0-flash-lite-preview-02-05:free" 
        : "google/gemini-2.0-flash-lite-preview-02-05:free"; 

    const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://padhaisetu.app",
        "X-Title": "PadhaiSetu",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
      }),
    });

    const data = await orResponse.json();

    if (data?.choices?.[0]?.message?.content) {
      return res.status(200).json({
        ok: true,
        text: data.choices[0].message.content.trim(),
        image: null,
        audio: null
      });
    } else if (data.error) {
       console.error("OpenRouter Error:", data.error);
       return res.status(200).json({ ok: false, text: `AI Error: ${data.error.message || "Unknown"}` });
    }

    return res.status(200).json({ ok: false, text: "No response from AI provider." });

  } catch (err) {
    console.error("Backend Handler Error:", err);
    return res.status(500).json({ ok: false, text: "Internal Server Error" });
  }
}
