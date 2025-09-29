const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

// Configuration de la base de données
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
    const { action } = req.body;

    switch (action) {
      case 'create':
        return await handleCreateRating(req, res);
      case 'my-ratings':
        return await handleMyRatings(req, res);
      case 'get':
        return await handleGetRating(req, res);
      case 'update':
        return await handleUpdateRating(req, res);
      case 'delete':
        return await handleDeleteRating(req, res);
      default:
        return res.status(400).json({ error: 'Action non reconnue' });
    }
  } catch (error) {
    console.error("Erreur API ratings:", error);
    return res.status(500).json({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}

// CRÉER UN RATING
async function handleCreateRating(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

    // Vérifier le token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const {
    eventId,
    overallRating,
    presenceTiming,
    quickTags = [],
    detailedCriteria = {},
    contextInfo = {},
    comment = "",
    ratingMetadata = {},
    } = req.body;

  console.log("📊 Données reçues:", {
    eventId,
    overallRating,
    presenceTiming,
    quickTags,
    detailedCriteria,
    contextInfo,
    comment,
    ratingMetadata,
  });

  // Vérifier que l'utilisateur a participé à l'événement (optionnel)
  const participationCheck = await pool.query(
    "SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2",
    [parseInt(eventId), decoded.userId]
  );

  const isRegistered = participationCheck.rows.length > 0;

  // Préparer les données de timing
  const arrivalTime = presenceTiming?.arrivalTime || null;
  const departureTime = presenceTiming?.stillPresent
    ? null
    : presenceTiming?.departureTime || null;
  const stillPresent = presenceTiming?.stillPresent || false;

  // Préparer les données contextuelles
  const crowdLevel = contextInfo?.crowdLevel || null;
  const weatherConditions = contextInfo?.weatherConditions || null;

  // Enrichir les métadonnées
  const enrichedMetadata = {
    ...ratingMetadata,
    isRegistered,
    submissionSource: "web",
    version: "2.0",
  };

  console.log("🔄 Insertion/Update dans la base...");

  // Insérer la notation avec le nouveau système
  const result = await pool.query(
    `
    INSERT INTO ratings (
      event_id, user_id, overall_rating,
      arrival_time, departure_time, still_present,
      quick_tags, detailed_criteria,
      crowd_level, weather_conditions,
      comment, rating_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (event_id, user_id) 
    DO UPDATE SET
      overall_rating = EXCLUDED.overall_rating,
      arrival_time = EXCLUDED.arrival_time,
      departure_time = EXCLUDED.departure_time,
      still_present = EXCLUDED.still_present,
      quick_tags = EXCLUDED.quick_tags,
      detailed_criteria = EXCLUDED.detailed_criteria,
      crowd_level = EXCLUDED.crowd_level,
      weather_conditions = EXCLUDED.weather_conditions,
      comment = EXCLUDED.comment,
      rating_metadata = EXCLUDED.rating_metadata,
      updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
        [
      parseInt(eventId),
      decoded.userId,
      parseFloat(overallRating),
      arrivalTime,
      departureTime,
      stillPresent,
      JSON.stringify(quickTags),
      JSON.stringify(detailedCriteria),
      crowdLevel,
      weatherConditions,
          comment,
      JSON.stringify(enrichedMetadata),
    ]
  );

  console.log("✅ Rating sauvegardé:", result.rows[0]);

  // Préparer la réponse avec parsing sécurisé
  const ratingResult = result.rows[0];
  let parsedQuickTags = [];
  let parsedDetailedCriteria = {};
  let parsedRatingMetadata = {};

  try {
    parsedQuickTags =
      typeof ratingResult.quick_tags === "string"
        ? JSON.parse(ratingResult.quick_tags)
        : ratingResult.quick_tags || [];
  } catch (e) {
    console.warn("⚠️ Erreur parsing quick_tags:", e.message);
    parsedQuickTags = [];
  }

  try {
    parsedDetailedCriteria =
      typeof ratingResult.detailed_criteria === "string"
        ? JSON.parse(ratingResult.detailed_criteria)
        : ratingResult.detailed_criteria || {};
  } catch (e) {
    console.warn("⚠️ Erreur parsing detailed_criteria:", e.message);
    parsedDetailedCriteria = {};
  }

  try {
    parsedRatingMetadata =
      typeof ratingResult.rating_metadata === "string"
        ? JSON.parse(ratingResult.rating_metadata)
        : ratingResult.rating_metadata || {};
  } catch (e) {
    console.warn("⚠️ Erreur parsing rating_metadata:", e.message);
    parsedRatingMetadata = {};
  }

  res.status(201).json({
    message: "Notation détaillée enregistrée avec succès",
    rating: {
      ...ratingResult,
      quick_tags: parsedQuickTags,
      detailed_criteria: parsedDetailedCriteria,
      rating_metadata: parsedRatingMetadata,
    },
    summary: {
      hasQuickTags: quickTags.length > 0,
      hasDetailedCriteria: Object.keys(detailedCriteria).length > 0,
      presenceDuration:
        arrivalTime && departureTime ? "Définie" : "Indéfinie",
      contextProvided: !!(crowdLevel || weatherConditions),
    },
  });
}

// RÉCUPÉRER MES RATINGS
async function handleMyRatings(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Récupérer tous les ratings de l'utilisateur
  const result = await pool.query(
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
}

// RÉCUPÉRER UN RATING SPÉCIFIQUE
async function handleGetRating(req, res) {
  const { ratingId } = req.body;

  const result = await pool.query(
    `SELECT r.*, e.title as event_title, e.date_start as event_date, e.location_city
     FROM ratings r
     JOIN events e ON r.event_id = e.id
     WHERE r.id = $1`,
    [ratingId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Rating non trouvé" });
  }

  res.status(200).json(result.rows[0]);
}

// MODIFIER UN RATING
async function handleUpdateRating(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const { ratingId, overallRating, comment, quickTags, detailedCriteria } = req.body;

  const result = await pool.query(
    `UPDATE ratings 
     SET overall_rating = $1, comment = $2, quick_tags = $3, detailed_criteria = $4, updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [
      overallRating,
          comment,
      JSON.stringify(quickTags || []),
      JSON.stringify(detailedCriteria || {}),
      ratingId,
      decoded.userId
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Rating non trouvé ou non autorisé" });
  }

  res.status(200).json(result.rows[0]);
}

// SUPPRIMER UN RATING
async function handleDeleteRating(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const { ratingId } = req.body;

  const result = await pool.query(
    "DELETE FROM ratings WHERE id = $1 AND user_id = $2 RETURNING *",
    [ratingId, decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Rating non trouvé ou non autorisé" });
  }

  res.status(200).json({ message: "Rating supprimé avec succès" });
}
