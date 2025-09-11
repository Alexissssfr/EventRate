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
    const { token, newPassword } = req.body;

    console.log('=== RÉINITIALISATION MOT DE PASSE ===');
    console.log('Token reçu:', token);
    console.log('Nouveau mot de passe:', newPassword ? '***' : 'non fourni');
    console.log('Body complet:', JSON.stringify(req.body, null, 2));

    // Vérifier que le token et le nouveau mot de passe sont fournis
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
    }

    // Vérifier la force du mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

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

    // Vérifier que le token existe et n'est pas expiré
    console.log('🔍 Recherche du token dans la base de données...');
    const tokenQuery = `
      SELECT prt.user_id, prt.expires_at, u.email, u.first_name
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = $1 AND prt.expires_at > NOW()
    `;
    
    console.log('🔍 Exécution de la requête token...');
    const tokenResult = await pool.query(tokenQuery, [token]);
    console.log('🔍 Résultat de la requête token:', tokenResult.rows.length, 'lignes trouvées');

    if (tokenResult.rows.length === 0) {
      console.log('Token invalide ou expiré');
      return res.status(400).json({ 
        error: 'Token invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation.' 
      });
    }

    const { user_id, email, first_name } = tokenResult.rows[0];
    console.log('✅ Token valide pour utilisateur:', email, 'ID:', user_id);

    // Hasher le nouveau mot de passe (version simplifiée)
    console.log('🔐 Hachage du nouveau mot de passe...');
    const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
    console.log('🔐 Mot de passe haché:', hashedPassword.substring(0, 20) + '...');

    // Mettre à jour le mot de passe de l'utilisateur
    console.log('💾 Mise à jour du mot de passe en base...');
    const updatePasswordQuery = 'UPDATE users SET password = $1 WHERE id = $2';
    const updateResult = await pool.query(updatePasswordQuery, [hashedPassword, user_id]);
    console.log('💾 Résultat de la mise à jour:', updateResult.rowCount, 'lignes modifiées');

    // Supprimer le token de réinitialisation (il ne peut être utilisé qu'une fois)
    console.log('🗑️ Suppression du token de réinitialisation...');
    const deleteTokenQuery = 'DELETE FROM password_reset_tokens WHERE user_id = $1';
    const deleteResult = await pool.query(deleteTokenQuery, [user_id]);
    console.log('🗑️ Token supprimé:', deleteResult.rowCount, 'lignes supprimées');

    console.log(`✅ Mot de passe réinitialisé avec succès pour: ${email}`);

    return res.status(200).json({
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation du mot de passe:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
