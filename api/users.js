const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, userId } = req.body;

    switch (action) {
      case 'profile':
        return await handleGetProfile(req, res);
      case 'update-profile':
        return await handleUpdateProfile(req, res);
      case 'my-events':
        return await handleMyEvents(req, res);
      case 'my-ratings':
        return await handleMyRatings(req, res);
      default:
        return res.status(400).json({ error: 'Action non reconnue' });
    }
  } catch (error) {
    console.error('Erreur API users:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

// RÉCUPÉRER LE PROFIL UTILISATEUR
async function handleGetProfile(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Récupérer le profil de l'utilisateur
  const result = await pool.query(
    'SELECT id, username, email, first_name, last_name, created_at FROM users WHERE id = $1',
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.status(200).json(result.rows[0]);
}

// METTRE À JOUR LE PROFIL UTILISATEUR
async function handleUpdateProfile(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const { username, email, firstName, lastName } = req.body;

  // Vérifier si le nouveau username/email n'est pas déjà pris
  if (username || email) {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
      [username, email, decoded.userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username ou email déjà utilisé' });
    }
  }

  // Mettre à jour le profil
  const result = await pool.query(
    'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name) WHERE id = $5 RETURNING id, username, email, first_name, last_name',
    [username, email, firstName, lastName, decoded.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  res.status(200).json(result.rows[0]);
}

// RÉCUPÉRER MES ÉVÉNEMENTS
async function handleMyEvents(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Récupérer les événements de l'utilisateur
  const result = await pool.query(`
    SELECT id, title, description, category,
           date_start, date_end, location_address, location_city,
           capacity, price_amount, price_is_free, 
           photos, images, creator_id, created_at, updated_at,
           current_attendees, rating_average, rating_count
    FROM events 
    WHERE creator_id = $1
    ORDER BY date_start ASC
  `, [decoded.userId]);

  // Parser les photos JSON et mapper les colonnes
  const events = result.rows.map((event) => ({
    ...event,
    location:
      (event.location_address || '') +
      (event.location_city ? `, ${event.location_city}` : ""),
    photos: event.photos
      ? typeof event.photos === "string"
        ? JSON.parse(event.photos)
        : event.photos
      : [],
  }));

  res.status(200).json(events);
}

// RÉCUPÉRER MES RATINGS
async function handleMyRatings(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Vérifier le token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Récupérer les avis de l'utilisateur avec les informations des événements
  const result = await pool.query(`
    SELECT r.id, r.overall_rating, r.comment, r.created_at, r.updated_at,
           r.detailed_criteria, r.quick_tags, r.rating_metadata,
           r.arrival_time, r.departure_time, r.still_present, r.crowd_level, r.weather_conditions,
           e.id as event_id, e.title as event_title, 
           e.date_start as event_date, e.location_city
    FROM ratings r
    JOIN events e ON r.event_id = e.id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
  `, [decoded.userId]);

  // Parser les champs JSONB
  const ratings = result.rows.map((rating) => ({
    ...rating,
    quick_tags:
      typeof rating.quick_tags === "string"
        ? rating.quick_tags
          ? JSON.parse(rating.quick_tags)
          : []
        : rating.quick_tags || [],
    detailed_criteria:
      typeof rating.detailed_criteria === "string"
        ? rating.detailed_criteria
          ? JSON.parse(rating.detailed_criteria)
          : {}
        : rating.detailed_criteria || {},
    rating_metadata:
      typeof rating.rating_metadata === "string"
        ? rating.rating_metadata
          ? JSON.parse(rating.rating_metadata)
          : {}
        : rating.rating_metadata || {},
  }));

  res.status(200).json(ratings);
}
