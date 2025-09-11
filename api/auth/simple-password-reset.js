const { Pool } = require('pg');
const crypto = require('crypto');

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
    const { email } = req.body;

    console.log('=== DEMANDE DE RÉCUPÉRATION SIMPLE ===');
    console.log('Email:', email);

    // Vérifier que l'email est fourni
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifier que l'utilisateur existe
    const userQuery = 'SELECT id, email, first_name FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun compte trouvé avec cet email' });
    }

    const { id: user_id, email: userEmail, first_name } = userResult.rows[0];

    // Créer la table si elle n'existe pas
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          token VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (tableError) {
      console.log('Table creation error:', tableError.message);
    }

    // Supprimer les anciens tokens pour cet utilisateur
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user_id]);

    // Générer un token simple (6 caractères)
    const simpleToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Créer un token de réinitialisation (expire dans 1 heure)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Insérer le nouveau token
    const insertTokenQuery = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;
    await pool.query(insertTokenQuery, [user_id, simpleToken, expiresAt]);

    // URL de réinitialisation
    const frontendUrl = process.env.FRONTEND_URL || 'https://eventrate.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${simpleToken}`;

    console.log(`✅ Code de récupération généré pour ${userEmail}: ${simpleToken}`);
    console.log(`🔗 Lien: ${resetUrl}`);

    // Retourner le code et le lien directement
    return res.status(200).json({
      success: true,
      message: 'Code de récupération généré avec succès',
      code: simpleToken,
      resetUrl: resetUrl,
      userEmail: userEmail,
      firstName: first_name
    });

  } catch (error) {
    console.error('❌ Erreur lors de la génération du code:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
