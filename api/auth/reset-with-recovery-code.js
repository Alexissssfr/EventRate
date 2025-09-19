const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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
    const { email, recoveryCode, newPassword } = req.body;

    console.log('=== RÉINITIALISATION AVEC CODE DE RÉCUPÉRATION ===');
    console.log('Email:', email);
    console.log('Code de récupération:', recoveryCode);
    console.log('Nouveau mot de passe:', newPassword ? '***' : 'non fourni');

    // Vérifier que tous les champs sont fournis
    if (!email || !recoveryCode || !newPassword) {
      return res.status(400).json({ error: 'Email, code de récupération et nouveau mot de passe requis' });
    }

    // Vérifier la force du mot de passe
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier que l'utilisateur existe et que le code de récupération correspond
    const userQuery = `
      SELECT id, email, first_name, recovery_code 
      FROM users 
      WHERE email = $1 AND recovery_code = $2
    `;
    
    console.log('🔍 Recherche de l\'utilisateur avec le code de récupération...');
    console.log('🔍 Email recherché:', email);
    console.log('🔍 Code recherché:', recoveryCode);
    
    const userResult = await pool.query(userQuery, [email, recoveryCode]);
    console.log('🔍 Résultat de la requête:', userResult.rows.length, 'utilisateur(s) trouvé(s)');

    if (userResult.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé ou code de récupération incorrect');
      return res.status(400).json({ 
        error: 'Email ou code de récupération incorrect' 
      });
    }

    const { id: user_id, email: userEmail, first_name } = userResult.rows[0];
    console.log('✅ Utilisateur trouvé:', userEmail, 'ID:', user_id);

    // Hasher le nouveau mot de passe avec bcrypt (comme dans login.js)
    console.log('🔐 Hachage du nouveau mot de passe avec bcrypt...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    console.log('🔐 Mot de passe haché avec bcrypt');

    // Mettre à jour le mot de passe de l'utilisateur
    console.log('💾 Mise à jour du mot de passe en base...');
    const updatePasswordQuery = 'UPDATE users SET password_hash = $1 WHERE id = $2';
    const updateResult = await pool.query(updatePasswordQuery, [hashedPassword, user_id]);
    console.log('💾 Résultat de la mise à jour:', updateResult.rowCount, 'lignes modifiées');

    console.log(`✅ Mot de passe réinitialisé avec succès pour: ${userEmail}`);

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
