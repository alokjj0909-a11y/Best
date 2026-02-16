// gemini.js (Groq backend)

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function callBackendAI({ mode = "text", contents }) {
  if (!GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const messages = [
    {
      role: "system",
      content:
        "You are Badi Didi, a caring Indian tutor. Answer clearly, kindly, and simply."
    },
    {
      role: "user",
      content: contents
    }
  ];

  const payload = {
    model: "llama-3.1-8b-instruct",
    messages,
    temperature: 0.7,
    max_tokens: 800,
    stream: false
  };

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
        const errText = await res.text();
        throw new Error(`Groq error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error("Empty response from Groq");
      }

      return reply;
    } catch (err) {
      console.error(`Groq attempt ${attempt} failed`, err);

      if (attempt === MAX_RETRIES) {
        return "AI thodi busy hai. Thodi der baad try karo 🙏";
      }

      // short delay before retry
      await new Promise(r => setTimeout(r, 800));
    }
  }
}
