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
      console.log("🔍 Tentative de récupération des événements...");

      // Vérifier d'abord si la table events existe
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'events'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        console.log("❌ Table events n'existe pas");
        return res.status(200).json([]);
      }

      // Récupérer tous les événements avec les vraies colonnes Supabase
      const result = await pool.query(`
        SELECT id, title, description, category,
               date_start, date_end, location_address, location_city,
               price_amount, price_currency, price_is_free, capacity,
               current_attendees, creator_id, status, rating_average,
               rating_count, images, photos, created_at
        FROM events 
        ORDER BY date_start DESC
      `);

      // S'assurer que result.rows est un tableau
      const events = result.rows || [];
      console.log("✅ Événements récupérés:", events.length);
      console.log("📋 Premiers événements:", events.slice(0, 2));
      
      // Debug des photos
      events.forEach((event, index) => {
        if (index < 3) { // Log seulement les 3 premiers
          console.log(`📸 Événement ${index + 1} - Photos:`, event.photos);
          console.log(`📸 Événement ${index + 1} - Images:`, event.images);
        }
      });

      return res.status(200).json(events);
    }

    if (req.method === "POST") {
      const {
        title,
        description,
        category,
        dateStart,
        dateEnd,
        locationAddress,
        locationCity,
        priceAmount,
        priceCurrency,
        priceIsFree,
        capacity,
        creatorId
      } = req.body;

      const result = await pool.query(
        `INSERT INTO events (title, description, category, date_start, date_end, 
                           location_address, location_city, price_amount, price_currency, 
                           price_is_free, capacity, creator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          title,
          description,
          category,
          dateStart,
          dateEnd,
          locationAddress,
          locationCity,
          priceAmount,
          priceCurrency || 'EUR',
          priceIsFree !== undefined ? priceIsFree : true,
          capacity || 0,
          creatorId
        ]
      );

      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (error) {
    console.error("Erreur API events:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}
