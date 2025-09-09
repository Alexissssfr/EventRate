const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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
    const { token, newPassword } = req.body;

    // Vérifier que le token et le nouveau mot de passe sont fournis
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }

    // Vérifier la force du mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Créer la table si elle n'existe pas
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP NULL
      );
    `;
    
    await pool.query(createTableQuery);

    // Vérifier que le token existe et n'est pas expiré
    const tokenQuery = `
      SELECT prt.user_id, prt.expires_at, u.email, u.first_name
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = $1 AND prt.expires_at > NOW()
    `;
    
    const tokenResult = await pool.query(tokenQuery, [token]);

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Token invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.' 
      });
    }

    const { user_id, email, first_name } = tokenResult.rows[0];

    // Hasher le nouveau mot de passe
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe de l'utilisateur
    const updatePasswordQuery = 'UPDATE users SET password = $1 WHERE id = $2';
    await pool.query(updatePasswordQuery, [hashedPassword, user_id]);

    // Supprimer le token de réinitialisation (il ne peut être utilisé qu'une fois)
    const deleteTokenQuery = 'DELETE FROM password_reset_tokens WHERE user_id = $1';
    await pool.query(deleteTokenQuery, [user_id]);

    // Log pour le suivi
    console.log(`Mot de passe réinitialisé pour l'utilisateur: ${email}`);

    return res.status(200).json({
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'
    });

  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur' 
    });
  }
}
