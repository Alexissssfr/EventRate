module.exports = async function handler(req, res) {
  try {
    const env = process.env;
    
    const envCheck = {
      DATABASE_URL: !!env.DATABASE_URL,
      SUPABASE_DB_URL: !!env.SUPABASE_DB_URL,
      SUPABASE_DB_HOST: !!env.SUPABASE_DB_HOST,
      SUPABASE_DB_USER: !!env.SUPABASE_DB_USER,
      SUPABASE_DB_PASSWORD: !!env.SUPABASE_DB_PASSWORD,
      NODE_ENV: env.NODE_ENV
    };

    // Test de connexion Supabase
    let connectionTest = null;
    try {
      const { Pool } = require('pg');
      const url = env.DATABASE_URL;
      
      if (url) {
        const urlObj = new URL(url);
        connectionTest = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          contains_pooler: url.includes('.pooler.'),
          url_start: url.substring(0, 30)
        };

        const pool = new Pool({
          connectionString: url,
          max: 1,
          connectionTimeoutMillis: 5000
        });

        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        await pool.end();

        connectionTest.success = true;
        connectionTest.server_time = result.rows[0].now;
      }
    } catch (error) {
      connectionTest = connectionTest || {};
      connectionTest.error = {
        code: error.code,
        message: error.message.substring(0, 200),
        hostname: error.hostname
      };
    }

    res.status(200).json({
      env_check: envCheck,
      connection_test: connectionTest,
      message: "Test de connexion Supabase"
    });

  } catch (error) {
    res.status(500).json({
      error: "Erreur debug",
      details: error.message
    });
  }
};
