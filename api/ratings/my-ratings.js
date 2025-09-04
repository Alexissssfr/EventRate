const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

// Configuration de la base de données
const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = async function handler(req, res) {
  // Configuration CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    // Vérifier le token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer tous les ratings de l'utilisateur
    const result = await db.query(
      `SELECT r.*, e.title as event_title, e.date_start as event_date, e.location_city
       FROM ratings r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [decoded.userId]
    );

    res.status(200).json({
      ratings: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Erreur récupération mes ratings:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
};
