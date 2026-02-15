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
    // 2. API KEY
    // ===============================
    const API_KEY =
      process.env.SILICONFLOW_API_KEY ||
      process.env.HUGGINGFACE_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        error: "API key missing (SiliconFlow / HuggingFace)",
      });
    }

    // ===============================
    // 3. REQUEST BODY
    // ===============================
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { messages } = body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid messages format",
      });
    }

    // ===============================
    // 4. MODEL (SERVER SIDE ONLY)
    // ===============================
    const MODEL = "deepseek-ai/DeepSeek-V3";

    // ===============================
    // 5. AI API CALL
    // ===============================
    const response = await fetch(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
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
    // 6. SAFE RESPONSE PARSING
    // ===============================
    let text = null;

    // OpenAI compatible
    if (data?.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    }

    // Streaming / delta style
    else if (data?.choices?.[0]?.delta?.content) {
      text = data.choices[0].delta.content;
    }

    // Some SiliconFlow models
    else if (data?.output_text) {
      text = data.output_text;
    }

    if (text) {
      return res.status(200).json({ text: text.trim() });
    }

    // ===============================
    // 7. FINAL FALLBACK (NEVER FAIL)
    // ===============================
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
