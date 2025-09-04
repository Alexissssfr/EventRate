const { Pool } = require("pg");

module.exports = async function handler(req, res) {
  try {
    // Créer une nouvelle connexion pour tester
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Test simple de connexion
    const result = await pool.query('SELECT NOW() as current_time');
    
    await pool.end(); // Fermer la connexion
    
    res.status(200).json({
      success: true,
      message: "Connexion Supabase réussie !",
      timestamp: result.rows[0].current_time
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail || "Pas de détails supplémentaires"
    });
  }
};
