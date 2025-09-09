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

    // Vérifier que l'email est fourni
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Vérifier le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    // Vérifier si l'utilisateur existe
    const userQuery = 'SELECT id, email, first_name FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      // Pour des raisons de sécurité, on ne révèle pas si l'email existe ou non
      return res.status(200).json({ 
        message: 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.' 
      });
    }

    const user = userResult.rows[0];

    // Générer un token de réinitialisation unique
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure

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

    // Créer les index si ils n'existent pas
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
    `;
    
    await pool.query(createIndexesQuery);

    // Sauvegarder le token dans la base de données
    const tokenQuery = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        token = EXCLUDED.token,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    `;
    
    await pool.query(tokenQuery, [user.id, resetToken, resetTokenExpiry]);

    // Construire le lien de réinitialisation
    const resetLink = `${process.env.FRONTEND_URL || 'https://eventrate.vercel.app'}/reset-password?token=${resetToken}`;

    // Envoyer l'email (simulation pour l'instant)
    // Dans un vrai projet, vous utiliseriez un service comme SendGrid, Mailgun, etc.
    console.log('=== EMAIL DE RÉINITIALISATION ===');
    console.log(`Destinataire: ${user.email}`);
    console.log(`Nom: ${user.first_name}`);
    console.log(`Lien de réinitialisation: ${resetLink}`);
    console.log('================================');

    // Pour l'instant, on simule l'envoi d'email
    // Dans un environnement de production, vous devriez :
    // 1. Utiliser un service d'email comme SendGrid, Mailgun, ou AWS SES
    // 2. Créer un template d'email professionnel
    // 3. Gérer les erreurs d'envoi d'email

    return res.status(200).json({
      message: 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.',
      // En développement, on peut retourner le lien pour les tests
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation de mot de passe:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur' 
    });
  }
}
