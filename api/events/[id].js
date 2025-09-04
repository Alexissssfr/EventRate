const { Pool } = require("pg");

// Configuration de la base de données pour Vercel
const pool = new Pool({
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

  try {
    if (req.method === "GET") {
      // Récupérer un événement spécifique
      const result = await pool.query(
        `
        SELECT id, title, description, category,
               date_start, date_end, location_address, location_city,
               capacity, price_amount, price_is_free, 
               photos, creator_id, created_at, updated_at
        FROM events 
        WHERE id = $1
      `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Événement non trouvé" });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === "PUT") {
      // Modifier un événement
      const { title, description, category, date_start, date_end, location_address, location_city, photos } = req.body;
      
      // Debug temporaire
      console.log('Photos reçues:', photos);

      const result = await pool.query(
        `
        UPDATE events 
        SET title = $1, description = $2, category = $3, 
            date_start = $4, date_end = $5, location_address = $6, 
            location_city = $7, photos = $8, images = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `,
        [title, description, category, date_start, date_end, location_address, location_city, photos || [], id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Événement non trouvé" });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === "DELETE") {
      // Supprimer un événement
      const result = await pool.query(
        "DELETE FROM events WHERE id = $1 RETURNING *",
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Événement non trouvé" });
      }

      return res
        .status(200)
        .json({ message: "Événement supprimé avec succès" });
    }

    // Méthode non supportée
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur API events/[id]:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
