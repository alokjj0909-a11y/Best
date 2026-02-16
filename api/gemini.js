// gemini.js — FINAL, GROQ SAFE VERSION

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function callBackendAI({ mode = "text", contents }) {
  if (!GROQ_API_KEY) {
    return "Server config error: API key missing";
  }

  // ✅ STEP 1: contents ko PURE STRING banana
  let userText = "";

  try {
    if (typeof contents === "string") {
      userText = contents;
    } else if (Array.isArray(contents)) {
      userText = contents
        .map(item => item?.parts?.[0]?.text || "")
        .join("\n")
        .trim();
    }
  } catch {
    userText = "";
  }

  if (!userText) {
    return "Kuch likho pehle 🙂";
  }

  // ✅ STEP 2: Groq messages
  const messages = [
    {
      role: "system",
      content:
        "You are Badi Didi, a caring Indian tutor. Answer kindly, clearly and in simple Hinglish/Hindi."
    },
    {
      role: "user",
      content: userText
    }
  ];

  // ✅ STEP 3: GROQ payload (NO STREAM)
  const payload = {
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
    max_tokens: 800,
    stream: false // 🔥 MOST IMPORTANT LINE
  };

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("Groq HTTP error:", t);
      return "AI thodi busy hai, thodi der baad try karo 🙏";
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "AI reply empty aaya 😅";
  } catch (err) {
    console.error("Groq fetch error:", err);
    return "Network ya server issue hai 🙏";
  }
}
