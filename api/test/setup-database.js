const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // Vérifier si la table existe
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'password_reset_tokens'
      );
    `;
    
    const tableExists = await pool.query(checkTableQuery);
    
    if (tableExists.rows[0].exists) {
      return res.status(200).json({
        message: 'Table password_reset_tokens existe déjà',
        table_exists: true
      });
    }

    // Créer la table si elle n'existe pas
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP NULL
      );
    `;

    await pool.query(createTableQuery);

    // Créer les index
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
    `;

    await pool.query(createIndexesQuery);

    return res.status(200).json({
      message: 'Table password_reset_tokens créée avec succès',
      table_created: true,
      indexes_created: true
    });

  } catch (error) {
    console.error('Erreur lors de la vérification/création de la table:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la vérification/création de la table',
      details: error.message
    });
  }
}
