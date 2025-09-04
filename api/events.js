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

  try {
    if (req.method === "GET") {
      // Récupérer tous les événements
      const result = await pool.query(`
        SELECT id, title, description, category,
               date_start, date_end, location_address, location_city,
               capacity, price_amount, price_is_free, 
               photos, creator_id, created_at, updated_at,
               0 as current_attendees, 0 as rating_average, 0 as rating_count
        FROM events 
        ORDER BY date_start ASC
      `);

      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      // Créer un nouvel événement
      const { title, date, time, location, description, category } = req.body;

      // Validation des données
      if (!title || !date || !time || !location || !category) {
        return res.status(400).json({
          error: "Tous les champs obligatoires doivent être remplis",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO events (title, date_start, date_end, location_address, location_city, description, category, creator_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
        [title, date, date, location, '', description, category, 1]
      );

      return res.status(201).json(result.rows[0]);
    }

    if (req.method === "DELETE") {
      // Supprimer un événement
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: "ID de l'événement requis" });
      }

      await pool.query("DELETE FROM events WHERE id = $1", [id]);

      return res
        .status(200)
        .json({ message: "Événement supprimé avec succès" });
    }

    // Méthode non supportée
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur API events:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
