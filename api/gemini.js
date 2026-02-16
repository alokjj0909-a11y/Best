// gemini.js (Groq backend – FINAL FIXED)

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function callBackendAI({ mode = "text", contents }) {
  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY");
  }

  // ✅ FIX: contents ko safe string banana
  let userText = "";

  if (typeof contents === "string") {
    userText = contents;
  } else if (Array.isArray(contents)) {
    userText =
      contents
        .map(c => c?.parts?.[0]?.text)
        .filter(Boolean)
        .join("\n") || "";
  } else {
    userText = "";
  }

  const messages = [
    {
      role: "system",
      content:
        "You are Badi Didi, a caring Indian tutor. Answer clearly, kindly, and simply."
    },
    {
      role: "user",
      content: userText
    }
  ];

  const payload = {
    model: "llama-3.3-70b-versatile", // ✅ BEST & STABLE
    messages,
    temperature: 0.7,
    max_tokens: 800
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

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "AI thodi busy hai 🙏";
  } catch (err) {
    console.error("Groq Error:", err);
    return "AI thodi busy hai. Thodi der baad try karo 🙏";
  }
      }
