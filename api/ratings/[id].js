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

  try {
    // Vérifier le token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id } = req.query;

    if (req.method === 'GET') {
      // Récupérer un avis spécifique
      const result = await db.query(`
        SELECT r.*, e.title as event_title, e.date_start as event_date
        FROM ratings r
        JOIN events e ON r.event_id = e.id
        WHERE r.id = $1 AND r.user_id = $2
      `, [id, decoded.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Avis non trouvé' });
      }

      res.status(200).json(result.rows[0]);
    }

    else if (req.method === 'PUT') {
      // Modifier un avis
      const { overall_rating, comment } = req.body;

      const result = await db.query(`
        UPDATE ratings 
        SET overall_rating = $1, comment = $2, updated_at = NOW()
        WHERE id = $3 AND user_id = $4
        RETURNING *
      `, [overall_rating, comment, id, decoded.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Avis non trouvé' });
      }

      res.status(200).json(result.rows[0]);
    }

    else if (req.method === 'DELETE') {
      // Supprimer un avis
      const result = await db.query(`
        DELETE FROM ratings 
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `, [id, decoded.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Avis non trouvé' });
      }

      res.status(200).json({ message: 'Avis supprimé avec succès' });
    }

    else {
      res.status(405).json({ error: 'Méthode non autorisée' });
    }

  } catch (error) {
    console.error('Erreur API ratings/[id]:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
