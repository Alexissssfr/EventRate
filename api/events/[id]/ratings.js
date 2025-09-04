const { Pool } = require('pg');

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
    const { id } = req.query;

    // Récupérer tous les avis pour cet événement
    const result = await db.query(`
      SELECT r.id, r.overall_rating, r.comment, r.created_at,
             u.username, u.avatar_url,
             r.ambiance_rating, r.organisation_rating, r.quality_rating
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = $1 AND r.status = 'active'
      ORDER BY r.created_at DESC
    `, [id]);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Erreur récupération avis événement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
