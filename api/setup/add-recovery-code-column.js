const { Pool } = require('pg');

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    console.log('🔧 Ajout de la colonne recovery_code à la table users...');

    // Ajouter la colonne recovery_code si elle n'existe pas
    const alterQuery = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS recovery_code VARCHAR(255)
    `;
    
    await pool.query(alterQuery);
    console.log('✅ Colonne recovery_code ajoutée avec succès');

    return res.status(200).json({
      message: 'Colonne recovery_code ajoutée avec succès à la table users'
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout de la colonne:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
