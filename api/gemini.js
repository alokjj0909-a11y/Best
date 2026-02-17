export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  try {
    const userMessage =
      req.body?.contents?.[0]?.parts?.[0]?.text || "Hello";

    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.HF_API_KEY}`
        },
        body: JSON.stringify({
          inputs: `You are Badi Didi from PadhaiSetu. Explain kindly in Hindi/Hinglish.\nUser: ${userMessage}`
        })
      }
    );

    const data = await response.json();

    const text =
      data?.[0]?.generated_text ||
      "Abhi jawab nahi mila 😓";

    res.status(200).json({ text });

  } catch (e) {
    res.status(500).json({ text: "AI error ho gaya 😓" });
  }
}
