export default async function handler(req, res) {
  return res.status(200).json({
    candidates: [
      {
        content: {
          parts: [{ text: "Backend bilkul theek hai ✅" }]
        }
      }
    ]
  });
}
