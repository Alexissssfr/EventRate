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

    // Créer la table si elle n'existe pas (version simplifiée)
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
      console.log('Table creation error (might already exist):', tableError.message);
    }

    // Supprimer les anciens tokens pour cet utilisateur
    try {
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    } catch (deleteError) {
      console.log('Delete old tokens error:', deleteError.message);
    }

    // Insérer le nouveau token
    try {
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, resetToken, resetTokenExpiry]
      );
    } catch (insertError) {
      console.log('Insert token error:', insertError.message);
      return res.status(500).json({ 
        error: 'Erreur lors de la sauvegarde du token',
        details: insertError.message
      });
    }

    // Construire le lien de réinitialisation
    const resetLink = `${process.env.FRONTEND_URL || 'https://eventrate.vercel.app'}/reset-password?token=${resetToken}`;

    // Log pour le développement
    console.log('=== EMAIL DE RÉINITIALISATION ===');
    console.log(`Destinataire: ${user.email}`);
    console.log(`Nom: ${user.first_name}`);
    console.log(`Lien de réinitialisation: ${resetLink}`);
    console.log('================================');

    return res.status(200).json({
      message: 'Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.',
      // En développement, on peut retourner le lien pour les tests
      ...(process.env.NODE_ENV === 'development' && { resetLink })
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation de mot de passe:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
