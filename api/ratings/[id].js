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
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (req.method === "GET") {
    // Récupérer un avis spécifique
    try {
      // Vérifier le token JWT
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token d'authentification requis" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const result = await db.query(
        `SELECT r.*, e.title as event_title, e.date_start as event_date
         FROM ratings r
         JOIN events e ON r.event_id = e.id
         WHERE r.id = $1 AND r.user_id = $2`,
        [id, decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Avis non trouvé" });
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error("Erreur récupération avis:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Token invalide" });
      }
      res.status(500).json({ error: "Erreur serveur" });
    }
  } else if (req.method === "PUT") {
    // Modifier un avis
    try {
      // Vérifier le token JWT
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token d'authentification requis" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const {
        overallRating,
        presenceTiming,
        quickTags,
        detailedCriteria,
        contextInfo,
        comment,
        ratingMetadata,
      } = req.body;

      // Vérifier que l'avis appartient à l'utilisateur
      const checkQuery = "SELECT user_id FROM ratings WHERE id = $1";
      const checkResult = await db.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Avis non trouvé" });
      }

      if (checkResult.rows[0].user_id !== decoded.userId) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      // Mettre à jour l'avis
      const updateQuery = `
        UPDATE ratings SET
          overall_rating = $1,
          arrival_time = $2,
          departure_time = $3,
          still_present = $4,
          quick_tags = $5,
          detailed_criteria = $6,
          crowd_level = $7,
          weather_conditions = $8,
          comment = $9,
          rating_metadata = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND user_id = $12
        RETURNING *
      `;

      const values = [
        overallRating,
        presenceTiming?.arrivalTime || null,
        presenceTiming?.departureTime || null,
        presenceTiming?.stillPresent || false,
        JSON.stringify(quickTags || []),
        JSON.stringify(detailedCriteria || {}),
        contextInfo?.crowdLevel || null,
        contextInfo?.weatherConditions || null,
        comment || null,
        JSON.stringify({
          ...ratingMetadata,
          lastModified: new Date().toISOString(),
        }),
        id,
        decoded.userId,
      ];

      const result = await db.query(updateQuery, values);

      res.json({
        message: "Avis modifié avec succès",
        rating: result.rows[0],
      });
    } catch (error) {
      console.error("Erreur modification avis:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Token invalide" });
      }
      res.status(500).json({ error: "Erreur serveur" });
    }
  } else if (req.method === "DELETE") {
    // Supprimer un avis
    try {
      // Vérifier le token JWT
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token d'authentification requis" });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Vérifier que l'avis appartient à l'utilisateur
      const checkQuery = "SELECT user_id FROM ratings WHERE id = $1";
      const checkResult = await db.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Avis non trouvé" });
      }

      if (checkResult.rows[0].user_id !== decoded.userId) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      // Supprimer l'avis
      const deleteQuery = "DELETE FROM ratings WHERE id = $1 AND user_id = $2";
      await db.query(deleteQuery, [id, decoded.userId]);

      res.json({ message: "Avis supprimé avec succès" });
    } catch (error) {
      console.error("Erreur suppression avis:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ error: "Token invalide" });
      }
      res.status(500).json({ error: "Erreur serveur" });
    }
  } else {
    res.status(405).json({ error: "Méthode non autorisée" });
  }
};
