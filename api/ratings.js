const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Configuration de la base de données
const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // Vérifier le token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Extraire toutes les données du rating
    const {
      event_id,
      overall_rating,
      ambiance_rating,
      organisation_rating,
      quality_rating,
      affluence_rating,
      value_rating,
      noise_level,
      visual_quality,
      comfort_rating,
      accessibility_rating,
      security_rating,
      services_rating,
      comment,
      attendance_time,
      crowd_level,
      weather_conditions,
      arrival_time,
      departure_time,
      still_present,
      quick_tags,
      detailed_criteria
    } = req.body;

    // Vérifier si l'utilisateur a déjà noté cet événement
    const existingRating = await db.query(
      'SELECT id FROM ratings WHERE user_id = $1 AND event_id = $2',
      [decoded.userId, event_id]
    );

    let result;
    if (existingRating.rows.length > 0) {
      // Mettre à jour l'avis existant
      result = await db.query(`
        UPDATE ratings SET
          overall_rating = $1, ambiance_rating = $2, organisation_rating = $3,
          quality_rating = $4, affluence_rating = $5, value_rating = $6,
          noise_level = $7, visual_quality = $8, comfort_rating = $9,
          accessibility_rating = $10, security_rating = $11, services_rating = $12,
          comment = $13, attendance_time = $14, crowd_level = $15,
          weather_conditions = $16, arrival_time = $17, departure_time = $18,
          still_present = $19, quick_tags = $20, detailed_criteria = $21,
          updated_at = NOW()
        WHERE user_id = $22 AND event_id = $23
        RETURNING *
      `, [
        overall_rating, ambiance_rating, organisation_rating, quality_rating,
        affluence_rating, value_rating, noise_level, visual_quality,
        comfort_rating, accessibility_rating, security_rating, services_rating,
        comment, attendance_time, crowd_level, weather_conditions,
        arrival_time, departure_time, still_present,
        JSON.stringify(quick_tags || []), JSON.stringify(detailed_criteria || {}),
        decoded.userId, event_id
      ]);
    } else {
      // Créer un nouvel avis
      result = await db.query(`
        INSERT INTO ratings (
          user_id, event_id, overall_rating, ambiance_rating, organisation_rating,
          quality_rating, affluence_rating, value_rating, noise_level,
          visual_quality, comfort_rating, accessibility_rating, security_rating,
          services_rating, comment, attendance_time, crowd_level,
          weather_conditions, arrival_time, departure_time, still_present,
          quick_tags, detailed_criteria
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23
        ) RETURNING *
      `, [
        decoded.userId, event_id, overall_rating, ambiance_rating,
        organisation_rating, quality_rating, affluence_rating, value_rating,
        noise_level, visual_quality, comfort_rating, accessibility_rating,
        security_rating, services_rating, comment, attendance_time,
        crowd_level, weather_conditions, arrival_time, departure_time,
        still_present, JSON.stringify(quick_tags || []),
        JSON.stringify(detailed_criteria || {})
      ]);
    }

    res.status(200).json({
      message: 'Avis enregistré avec succès',
      rating: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur création/modification avis:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
