module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const env = process.env;
    
    res.status(200).json({
      env_check: {
        DATABASE_URL: !!env.DATABASE_URL,
        SUPABASE_DB_URL: !!env.SUPABASE_DB_URL,
        JWT_SECRET: !!env.JWT_SECRET,
        NODE_ENV: env.NODE_ENV
      },
      dependencies: {
        bcryptjs: (() => { try { require('bcryptjs'); return true; } catch { return false; } })(),
        jsonwebtoken: (() => { try { require('jsonwebtoken'); return true; } catch { return false; } })(),
        pg: (() => { try { require('pg'); return true; } catch { return false; } })()
      },
      message: "Debug auth API"
    });
  } catch (error) {
    res.status(500).json({
      error: "Debug error",
      details: error.message
    });
  }
};
