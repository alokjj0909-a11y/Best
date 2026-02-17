// api/gemini.js — OPENAI FINAL (TEXT + VOICE)

import OpenAI from "openai";

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { mode = "text", contents, systemInstruction } = req.body;

    // =========================================================
    // 🎤 VOICE → TEXT (STT)
    // =========================================================
    const hasAudio =
      contents?.[0]?.parts?.some(p => p.inlineData?.mimeType?.startsWith("audio"));

    if (mode === "text" && hasAudio) {
      const audioPart = contents[0].parts.find(p => p.inlineData);
      const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");

      const transcript = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], "audio.webm"),
        model: "whisper-1",
      });

      return res.status(200).json({
        text: transcript.text,
      });
    }

    // =========================================================
    // 🔊 TEXT → VOICE (TTS)
    // =========================================================
    if (mode === "tts") {
      const text = contents?.[0]?.parts?.[0]?.text || "";

      const speech = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await speech.arrayBuffer());
      return res.status(200).json({
        audio: buffer.toString("base64"),
        text,
      });
    }

    // =========================================================
    // 🧠 TEXT CHAT
    // =========================================================
    if (mode === "text") {
      let systemPrompt = "You are Badi Didi, a caring Indian tutor.";
      if (systemInstruction?.parts?.[0]?.text) {
        systemPrompt = systemInstruction.parts[0].text;
      }

      const userText = contents[0].parts.map(p => p.text).join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // FAST + CHEAP + STABLE
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      return res.status(200).json({
        text: completion.choices[0].message.content,
      });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("OPENAI ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
        }
