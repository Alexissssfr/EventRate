const { Pool } = require("pg");

// Configuration de la base de données pour Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
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
               price, capacity, created_by, created_at,
               photos
        FROM events 
        ORDER BY date_start DESC
      `);

      // S'assurer que result.rows est un tableau
      const events = result.rows || [];
      console.log('Événements récupérés:', events.length);
      
      return res.status(200).json(events);
    }

    if (req.method === "POST") {
      const {
        title,
        description,
        category,
        date_start,
        date_end,
        location_address,
        location_city,
        price,
        capacity,
        created_by,
        photos
      } = req.body;

      const result = await pool.query(
        `INSERT INTO events (title, description, category, date_start, date_end, 
                           location_address, location_city, price, capacity, created_by, photos)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          title,
          description,
          category,
          date_start,
          date_end,
          location_address,
          location_city,
          price,
          capacity,
          created_by,
          photos
        ]
      );

      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    console.error("Erreur API events:", error);
    return res.status(500).json({ 
      error: "Erreur interne du serveur",
      details: error.message 
    });
  }
}
