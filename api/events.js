// Fonction serverless pour les événements
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const db = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware d'authentification
function authenticateToken(token) {
  if (!token) throw new Error('Token manquant');
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, query, body } = req;

  try {
    if (method === 'GET') {
      // Récupérer tous les événements
      const result = await db.query(`
        SELECT 
          e.id, e.title, e.description, e.location_address, e.location_city,
          e.date_start, e.date_end, e.category, e.capacity, e.price_amount, 
          e.price_is_free, e.photos, e.created_at,
          AVG(r.overall_rating) as rating_average,
          COUNT(r.id) as rating_count
        FROM events e
        LEFT JOIN ratings r ON e.id = r.event_id
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `);

      res.json({ events: result.rows });

    } else if (method === 'POST') {
      // Créer un nouvel événement
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      const user = authenticateToken(token);

      const {
        title, description, category, locationAddress, locationCity,
        dateStart, dateEnd, capacity, priceAmount, priceIsFree, photoUrls
      } = body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Titre et description requis' });
      }

      const result = await db.query(`
        INSERT INTO events (
          title, description, category, location_address, location_city,
          date_start, date_end, capacity, price_amount, price_is_free,
          photos, creator_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        title, description, category, locationAddress, locationCity,
        dateStart, dateEnd, capacity, priceAmount, priceIsFree,
        JSON.stringify(photoUrls || []), user.userId
      ]);

      res.status(201).json({
        message: 'Événement créé avec succès',
        event: result.rows[0]
      });

    } else {
      res.status(405).json({ error: 'Méthode non autorisée' });
    }
  } catch (error) {
    console.error('Erreur events:', error);
    if (error.message === 'Token manquant' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
