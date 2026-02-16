// gemini.js — GROQ HARD SAFE VERSION

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function callBackendAI({ mode = "text", contents }) {
  if (!GROQ_API_KEY) {
    return "Server config error: API key missing";
  }

  // 🔐 FORCE string only
  let userText = "";

  if (typeof contents === "string") {
    userText = contents.trim();
  } else if (Array.isArray(contents)) {
    userText = contents
      .map(c => {
        if (typeof c === "string") return c;
        if (c?.parts?.[0]?.text) return c.parts[0].text;
        return "";
      })
      .join("\n")
      .trim();
  }

  if (!userText) {
    return "Kuch likho pehle 🙂";
  }

  const payload = {
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are Badi Didi, a caring Indian tutor. Answer kindly, clearly and in simple Hindi/Hinglish."
      },
      {
        role: "user",
        content: userText
      }
    ],
    temperature: 0.7,
    max_tokens: 800,
    stream: false // 🚨 MUST
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text(); // 👈 IMPORTANT

    if (!res.ok) {
      console.error("Groq HTTP error:", text);
      return "AI thodi busy hai, thodi der baad try karo 🙏";
    }

    let data;
    try {
      data = JSON.parse(text); // 👈 SAFE parse
    } catch (e) {
      console.error("JSON parse failed:", text);
      return "AI ka reply thoda gadbad ho gaya 😅";
    }

    return data?.choices?.[0]?.message?.content || "AI reply empty aaya 😅";
  } catch (err) {
    console.error("Groq fetch error:", err);
    return "Network ya server issue hai 🙏";
  }
}
