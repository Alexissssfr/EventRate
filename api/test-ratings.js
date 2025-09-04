module.exports = async function handler(req, res) {
  console.log("🧪 TEST RATINGS API APPELÉE");
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

  // Test toutes les méthodes
  if (req.method === "GET") {
    res.status(200).json({
      message: "✅ GET fonctionne !",
      method: req.method,
      timestamp: new Date().toISOString()
    });
  } else if (req.method === "POST") {
    res.status(200).json({
      message: "✅ POST fonctionne !",
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  } else if (req.method === "PUT") {
    res.status(200).json({
      message: "✅ PUT fonctionne !",
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  } else if (req.method === "PATCH") {
    res.status(200).json({
      message: "✅ PATCH fonctionne !",
      method: req.method,
      body: req.body,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(405).json({
      error: "❌ Méthode non autorisée",
      method: req.method,
      allowed: ["GET", "POST", "PUT", "PATCH"]
    });
  }
};
