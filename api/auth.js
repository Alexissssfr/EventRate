import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pkg;

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.body;

    switch (action) {
      case 'login':
        return await handleLogin(req, res);
      case 'register':
        return await handleRegister(req, res);
      case 'reset':
        return await handleReset(req, res);
      case 'logout':
        return await handleLogout(req, res);
      default:
        return res.status(400).json({ error: 'Action non reconnue' });
    }
  } catch (error) {
    console.error('Erreur auth:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

// LOGIN
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  // Trouver l'utilisateur
  const result = await pool.query(
    'SELECT id, username, email, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const user = result.rows[0];

  // Vérifier le mot de passe
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  // Créer le token JWT
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Connexion réussie',
    token,
    user: { id: user.id, username: user.username, email: user.email }
  });
}

// REGISTER
async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { username, email, password, firstName, lastName, recoveryCode } = req.body;
  
  if (!username || !email || !password || !recoveryCode) {
    return res.status(400).json({ error: 'Tous les champs sont requis (username, email, password, recoveryCode)' });
        }

        // Vérifier si l'utilisateur existe déjà
  const existingUser = await pool.query(
          'SELECT id FROM users WHERE email = $1 OR username = $2',
          [email, username]
        );

        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: 'Utilisateur déjà existant' });
        }

        // Hasher le mot de passe
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Créer l'utilisateur
  const result = await pool.query(
    'INSERT INTO users (username, email, password_hash, first_name, last_name, recovery_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email',
    [username, email, hashedPassword, firstName || '', lastName || '', recoveryCode]
        );

        const user = result.rows[0];

        // Créer le token JWT
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          message: 'Utilisateur créé avec succès',
          token,
          user: { id: user.id, username: user.username, email: user.email }
        });
}

// RESET PASSWORD
async function handleReset(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

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

  // Hasher le nouveau mot de passe avec bcrypt
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
}

// LOGOUT
async function handleLogout(req, res) {
  // Pour une déconnexion simple, on retourne juste un succès
  // Le token sera invalidé côté client
  res.json({ message: 'Déconnexion réussie' });
}
