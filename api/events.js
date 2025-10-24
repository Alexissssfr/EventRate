import pkg from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

// Configuration de la base de données pour Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  console.log("🔍 API events appelée:", req.method, req.url);
  console.log("🔍 Headers:", req.headers);
  console.log("🔍 Body:", req.body);
  
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
           rating_count, images, photos, tags, views_count,
           is_featured, created_at, updated_at
    FROM events 
    WHERE status = 'active'
    ORDER BY date_start DESC
  `);

  // S'assurer que result.rows est un tableau
  const events = result.rows || [];
  console.log("✅ Événements récupérés:", events.length);

  return res.status(200).json(events);
}

// CRÉER UN ÉVÉNEMENT
async function handleCreateEvent(req, res) {
  try {
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
    creatorId,
    tags
  } = req.body;

  console.log("🔍 Données reçues pour création événement:", {
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
    creatorId,
    userId: decoded.userId
  });
  
  console.log("🚀 Début de la création d'événement...");
  console.log("📅 Timestamp:", new Date().toISOString());
  console.log("🔍 Tentative de connexion à la base de données...");

    const result = await pool.query(
      `INSERT INTO events (title, description, category, date_start, date_end, 
                         location_address, location_city, price_amount, price_currency, 
                         price_is_free, capacity, creator_id, tags)
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
        priceAmount || 0,
        priceCurrency || 'EUR',
        priceIsFree !== undefined ? priceIsFree : true,
        capacity || 0,
        creatorId || decoded.userId,
        tags || []
      ]
    );

    console.log("✅ Événement créé avec succès:", result.rows[0]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erreur création événement:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }
    return res.status(500).json({ error: "Erreur serveur" });
  }
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

  const { 
    title, 
    description, 
    category, 
    date_start, 
    date_end, 
    location_address, 
    location_city, 
    photos,
    price_amount,
    price_is_free,
    capacity
  } = req.body;
  
  console.log('🔍 Données reçues pour modification:', {
    id,
    title,
    price_amount,
    price_is_free,
    userId: decoded.userId
  });

  const result = await pool.query(
    `
    UPDATE events 
    SET title = $1, description = $2, category = $3, 
        date_start = $4, date_end = $5, location_address = $6, 
        location_city = $7, photos = $8, images = $8,
        price_amount = $9, price_is_free = $10, capacity = $11,
        updated_at = NOW()
    WHERE id = $12 AND creator_id = $13
    RETURNING *
  `,
    [
      title, 
      description, 
      category, 
      date_start, 
      date_end, 
      location_address, 
      location_city, 
      photos || [], 
      price_amount || 0, 
      price_is_free || false,
      capacity || 0,
      id, 
      decoded.userId
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Événement non trouvé ou non autorisé" });
  }

  console.log('✅ Événement modifié avec succès:', result.rows[0]);
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
