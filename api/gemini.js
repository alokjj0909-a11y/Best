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
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ===============================
    // 2. API KEY (OpenRouter)
    // ===============================
    const API_KEY = process.env.OPENROUTER_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        error: "OpenRouter API key missing",
      });
    }

    // ===============================
    // 3. REQUEST BODY
    // ===============================
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { messages, feature } = body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid messages format",
      });
    }

    // ===============================
    // 4. MODEL SELECTION (FREE)
    // ===============================
    function getModel(feature) {
      if (feature === "swadhyay") return "deepseek/deepseek-r1:free";
      return "gpt-4o-mini";
    }

    const MODEL = getModel(feature);

    // ===============================
    // 5. OPENROUTER API CALL
    // ===============================
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://padhaisetu.vercel.app",
          "X-Title": "PadhaaiSetu",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    // ===============================
    // 6. SAFE RESPONSE
    // ===============================
    if (data?.choices?.[0]?.message?.content) {
      return res.status(200).json({
        text: data.choices[0].message.content.trim(),
      });
    }

    console.error("Unknown AI response:", data);

    return res.status(200).json({
      text: "माफ कीजिए, अभी सिस्टम व्यस्त है। कृपया थोड़ी देर बाद प्रयास करें 🙏",
    });

  } catch (err) {
    console.error("Backend Error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
        }
