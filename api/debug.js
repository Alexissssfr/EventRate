module.exports = async function handler(req, res) {
  console.log("🐛 DEBUG API APPELÉE");
  console.log("📝 Méthode:", req.method);
  console.log("🌐 URL:", req.url);
  console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
  console.log("📦 Body:", req.body);
  
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  res.status(200).json({
    message: "🐛 API Debug fonctionne !",
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body
  });
};
