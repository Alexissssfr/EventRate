const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  try {
    // Vérifier si la colonne recovery_code existe
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'recovery_code'
    `;
    
    const result = await pool.query(checkColumnQuery);
    
    if (result.rows.length > 0) {
      return res.status(200).json({
        exists: true,
        message: 'La colonne recovery_code existe dans la table users'
      });
    } else {
      return res.status(200).json({
        exists: false,
        message: 'La colonne recovery_code n\'existe pas dans la table users'
      });
    }

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
