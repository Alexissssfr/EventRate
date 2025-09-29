const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

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
    // Pour les requêtes GET, utiliser l'ancien système
    if (req.method === "GET") {
      return await handleListEvents(req, res);
    }

    // Pour les requêtes POST, vérifier l'action
    if (req.method === "POST") {
      const { action, id } = req.body;

      switch (action) {
        case 'list':
          return await handleListEvents(req, res);
        case 'create':
          return await handleCreateEvent(req, res);
        case 'get':
          return await handleGetEvent(req, res, id);
        case 'update':
          return await handleUpdateEvent(req, res, id);
        case 'delete':
          return await handleDeleteEvent(req, res, id);
        default:
          // Fallback : si pas d'action, c'est une création
          return await handleCreateEvent(req, res);
      }
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (error) {
    console.error("Erreur API events:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// LISTER TOUS LES ÉVÉNEMENTS
async function handleListEvents(req, res) {
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

  return res.status(200).json(events);
}

// CRÉER UN ÉVÉNEMENT
async function handleCreateEvent(req, res) {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
      creatorId || decoded.userId
    ]
  );

  return res.status(201).json(result.rows[0]);
}

// RÉCUPÉRER UN ÉVÉNEMENT SPÉCIFIQUE
async function handleGetEvent(req, res, id) {
  const result = await pool.query(
    `
    SELECT id, title, description, category,
           date_start, date_end, location_address, location_city,
           capacity, price_amount, price_is_free, 
           photos, images, creator_id, created_at, updated_at
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

// MODIFIER UN ÉVÉNEMENT
async function handleUpdateEvent(req, res, id) {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const { title, description, category, date_start, date_end, location_address, location_city, photos } = req.body;
  
  // Debug temporaire
  console.log('Photos reçues:', photos);

  const result = await pool.query(
    `
    UPDATE events 
    SET title = $1, description = $2, category = $3, 
        date_start = $4, date_end = $5, location_address = $6, 
        location_city = $7, photos = $8, images = $8, updated_at = NOW()
    WHERE id = $9 AND creator_id = $10
    RETURNING *
  `,
    [title, description, category, date_start, date_end, location_address, location_city, photos || [], id, decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Événement non trouvé ou non autorisé" });
  }

  return res.status(200).json(result.rows[0]);
}

// SUPPRIMER UN ÉVÉNEMENT
async function handleDeleteEvent(req, res, id) {
  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const result = await pool.query(
    "DELETE FROM events WHERE id = $1 AND creator_id = $2 RETURNING *",
    [id, decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Événement non trouvé ou non autorisé" });
  }

  return res.status(200).json({ message: "Événement supprimé avec succès" });
}
