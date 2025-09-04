module.exports = function handler(req, res) {
  res.status(200).json({
    env_check: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPABASE_DB_URL: !!process.env.SUPABASE_DB_URL,
      SUPABASE_DB_HOST: !!process.env.SUPABASE_DB_HOST,
      SUPABASE_DB_USER: !!process.env.SUPABASE_DB_USER,
      SUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD,
      NODE_ENV: process.env.NODE_ENV
    },
    message: "Variables d'environnement vérifiées"
  });
};
