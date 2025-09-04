export default async function handler(req, res) {
    try {
        const env = process.env;
        
        // Variables d'environnement détaillées
        const envCheck = {
            DATABASE_URL: env.DATABASE_URL ? {
                exists: true,
                length: env.DATABASE_URL.length,
                starts_with: env.DATABASE_URL.substring(0, 20),
                contains_pooler: env.DATABASE_URL.includes('.pooler.'),
                port: env.DATABASE_URL.includes(':6543') ? '6543' : (env.DATABASE_URL.includes(':5432') ? '5432' : 'unknown')
            } : { exists: false },
            SUPABASE_DB_URL: env.SUPABASE_DB_URL ? {
                exists: true,
                length: env.SUPABASE_DB_URL.length,
                starts_with: env.SUPABASE_DB_URL.substring(0, 20)
            } : { exists: false },
            NODE_ENV: env.NODE_ENV
        };

        // Test de résolution DNS
        let dnsTest = null;
        try {
            const { Pool } = await import('pg');
            const url = env.DATABASE_URL || env.SUPABASE_DB_URL;
            
            if (url) {
                // Extraire l'hostname de l'URL
                const urlObj = new URL(url);
                const hostname = urlObj.hostname;
                
                dnsTest = {
                    hostname: hostname,
                    attempting_connection: true
                };

                // Test de connexion très rapide
                const pool = new Pool({
                    connectionString: url,
                    max: 1,
                    connectionTimeoutMillis: 5000,
                    idleTimeoutMillis: 1000
                });

                const client = await pool.connect();
                const result = await client.query('SELECT NOW()');
                client.release();
                await pool.end();

                dnsTest.connection_success = true;
                dnsTest.server_time = result.rows[0].now;
            }
        } catch (error) {
            dnsTest.connection_error = {
                code: error.code,
                message: error.message.substring(0, 200),
                errno: error.errno,
                syscall: error.syscall,
                hostname: error.hostname
            };
        }

        res.status(200).json({
            env_check: envCheck,
            dns_test: dnsTest,
            timestamp: new Date().toISOString(),
            vercel_region: process.env.VERCEL_REGION || 'unknown',
            message: "Debug avancé - connexion Supabase"
        });

    } catch (error) {
        res.status(500).json({
            error: "Erreur debug avancé",
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
