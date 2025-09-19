const crypto = require('crypto');

// Fonction pour générer un code de récupération unique
function generateRecoveryCode() {
  // Format: RC-XXXXXX-XXXXXX (ex: RC-ABC123-XYZ789)
  const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RC-${part1}-${part2}`;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const recoveryCode = generateRecoveryCode();
    
    console.log('🔑 Code de récupération généré:', recoveryCode);
    
    return res.status(200).json({
      recoveryCode: recoveryCode,
      message: 'Code de récupération généré avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur lors de la génération du code:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
}
