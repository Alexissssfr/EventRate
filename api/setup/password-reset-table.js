const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // Vérifier que la méthode est POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // Créer la table password_reset_tokens
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

    // Créer les index pour améliorer les performances
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
    `;

    await pool.query(createIndexesQuery);

    // Créer l'index unique sur user_id pour éviter plusieurs tokens actifs par utilisateur
    const createUniqueIndexQuery = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id_unique 
      ON password_reset_tokens(user_id) 
      WHERE expires_at > NOW();
    `;

    await pool.query(createUniqueIndexQuery);

    return res.status(200).json({
      message: 'Table password_reset_tokens créée avec succès',
      tables_created: ['password_reset_tokens'],
      indexes_created: [
        'idx_password_reset_tokens_token',
        'idx_password_reset_tokens_user_id', 
        'idx_password_reset_tokens_expires_at',
        'idx_password_reset_tokens_user_id_unique'
      ]
    });

  } catch (error) {
    console.error('Erreur lors de la création de la table:', error);
    return res.status(500).json({ 
      error: 'Erreur lors de la création de la table',
      details: error.message
    });
  }
}
