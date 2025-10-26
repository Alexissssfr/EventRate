import pkg from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  console.log("🔍 API ratings appelée:", req.method, req.url);
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
      return res.status(405).json({ error: 'Méthode GET non supportée' });
    }

    // Pour les requêtes POST, vérifier l'action
    if (req.method === "POST") {
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
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
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

  // Mettre à jour les statistiques de l'événement
  await updateEventRatingStats(parseInt(eventId));

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

// RÉCUPÉRER UN RATING SPÉCIFIQUE OU LES RATINGS D'UN ÉVÉNEMENT
async function handleGetRating(req, res) {
  const { ratingId, eventId } = req.body;

  if (eventId) {
    // Récupérer tous les ratings d'un événement
    const result = await pool.query(
      `SELECT r.*, e.title as event_title, e.date_start as event_date, e.location_city
       FROM ratings r
       JOIN events e ON r.event_id = e.id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [eventId]
    );

    res.status(200).json(result.rows);
  } else if (ratingId) {
    // Récupérer un rating spécifique
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
  } else {
    return res.status(400).json({ error: "ratingId ou eventId requis" });
  }
}

// MODIFIER UN RATING
async function handleUpdateRating(req, res) {
  // Accepter PUT et POST avec action update
  if (req.method !== "PUT" && req.method !== "POST") {
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
    ratingId, 
    overallRating, 
    comment, 
    quickTags, 
    detailedCriteria,
    ambianceRating,
    affluenceRating,
    organisationRating,
    qualityRating,
    valueRating,
    noiseLevel,
    visualQuality,
    comfortRating,
    accessibilityRating,
    securityRating,
    servicesRating,
    attendanceTime,
    crowdLevel,
    weatherConditions,
    photos
  } = req.body;

  const result = await pool.query(
    `UPDATE ratings 
     SET overall_rating = $1, comment = $2, quick_tags = $3, detailed_criteria = $4,
         ambiance_rating = $5, affluence_rating = $6, organisation_rating = $7,
         quality_rating = $8, value_rating = $9, noise_level = $10,
         visual_quality = $11, comfort_rating = $12, accessibility_rating = $13,
         security_rating = $14, services_rating = $15, attendance_time = $16,
         crowd_level = $17, weather_conditions = $18, photos = $19,
         updated_at = NOW()
     WHERE id = $20 AND user_id = $21
     RETURNING *`,
    [
      overallRating,
      comment,
      JSON.stringify(quickTags || []),
      JSON.stringify(detailedCriteria || {}),
      ambianceRating,
      affluenceRating,
      organisationRating,
      qualityRating,
      valueRating,
      noiseLevel,
      visualQuality,
      comfortRating,
      accessibilityRating,
      securityRating,
      servicesRating,
      attendanceTime,
      crowdLevel,
      weatherConditions,
      photos || [],
      ratingId,
      decoded.userId
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Rating non trouvé ou non autorisé" });
  }

  // Mettre à jour les statistiques de l'événement
  const rating = result.rows[0];
  await updateEventRatingStats(rating.event_id);

  res.status(200).json(result.rows[0]);
}

// SUPPRIMER UN RATING
async function handleDeleteRating(req, res) {
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

  const { ratingId } = req.body;

  const result = await pool.query(
    "DELETE FROM ratings WHERE id = $1 AND user_id = $2 RETURNING *",
    [ratingId, decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Rating non trouvé ou non autorisé" });
  }

  // Mettre à jour les statistiques de l'événement
  const deletedRating = result.rows[0];
  await updateEventRatingStats(deletedRating.event_id);

  res.status(200).json({ message: "Rating supprimé avec succès" });
}

// FONCTION POUR METTRE À JOUR LES STATISTIQUES D'UN ÉVÉNEMENT
async function updateEventRatingStats(eventId) {
  try {
    console.log(`🔄 Mise à jour des statistiques pour l'événement ${eventId}`);
    
    // Calculer la moyenne et le nombre d'avis
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as rating_count,
        AVG(overall_rating) as rating_average
       FROM ratings 
       WHERE event_id = $1 AND status = 'active'`,
      [eventId]
    );

    const stats = statsResult.rows[0];
    const ratingCount = parseInt(stats.rating_count) || 0;
    const ratingAverage = stats.rating_average ? parseFloat(stats.rating_average) : 0;

    console.log(`📊 Statistiques calculées: ${ratingCount} avis, moyenne ${ratingAverage}`);

    // Mettre à jour la table events
    await pool.query(
      `UPDATE events 
       SET rating_count = $1, rating_average = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [ratingCount, ratingAverage, eventId]
    );

    console.log(`✅ Statistiques mises à jour pour l'événement ${eventId}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la mise à jour des statistiques pour l'événement ${eventId}:`, error);
  }
}
