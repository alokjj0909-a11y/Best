export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ text: "Method not allowed" });
  }

  try {
    const userText =
      req.body?.contents?.[0]?.parts?.[0]?.text || "Hello";

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: `You are Badi Didi from PadhaiSetu. Explain kindly in Hindi/Hinglish.\nUser: ${userText}`
        })
      }
    );

    const data = await hfRes.json();

    console.log("HF RAW RESPONSE:", data); // 👈 VERY IMPORTANT

    let text = "";

    if (Array.isArray(data) && data[0]?.generated_text) {
      text = data[0].generated_text;
    } else if (data?.generated_text) {
      text = data.generated_text;
    } else if (data?.error) {
      text = "Model load ho raha hai, 5–10 sec baad try karo 🙂";
    } else {
      text = "AI se response nahi mila 😓";
    }

    res.status(200).json({ text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "Server error 😓" });
  }
}
