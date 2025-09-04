const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

// Configuration de la base de données
const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = async function handler(req, res) {
  // LOGGING POUR DEBUG
  console.log("🔍 API RATINGS DETAILED APPELÉE:");
  console.log("📝 Méthode:", req.method);
  console.log("🌐 URL:", req.url);
  console.log("📋 Headers:", req.headers);
  console.log("📦 Body:", req.body);

  // Configuration CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request - CORS OK");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    console.log("❌ Méthode non autorisée:", req.method);
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  console.log("✅ Méthode autorisée:", req.method);

  try {
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
    const participationCheck = await db.query(
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
    const result = await db.query(
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
  } catch (error) {
    console.error("❌ Erreur notation détaillée:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la notation" });
  }
};
