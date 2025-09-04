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

  if (req.method !== 'GET') {
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
    const { userId } = req.query;

    // Vérifier que l'utilisateur demande ses propres événements
    if (decoded.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Récupérer les événements de l'utilisateur
    const result = await db.query(`
      SELECT id, title, description, category,
             date_start, date_end, location_address, location_city,
             capacity, price_amount, price_is_free, 
             photos, creator_id, created_at, updated_at,
             0 as current_attendees, 0 as rating_average, 0 as rating_count
      FROM events 
      WHERE creator_id = $1
      ORDER BY date_start ASC
    `, [userId]);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erreur récupération événements utilisateur:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
