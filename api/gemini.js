export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      text: "Method not allowed"
    });
  }

  // 🔥 Backend test response (HTML expects `text`)
  return res.status(200).json({
    text: "Backend bilkul theek hai ✅"
  });
}
