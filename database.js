const { Pool } = require("pg");

// Configuration de la base de données Supabase PostgreSQL
const pool = new Pool({
  user: process.env.SUPABASE_DB_USER || "postgres",
  host: process.env.SUPABASE_DB_HOST || "db.your-project-ref.supabase.co",
  database: process.env.SUPABASE_DB_NAME || "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "your-password",
  port: process.env.SUPABASE_DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20, // Nombre maximum de connexions
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialisation de la base de données
async function initDatabase() {
  try {
    // Créer les tables
    await createTables();
    console.log("✅ Base de données Supabase initialisée avec succès");
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'initialisation de la base de données:",
      error
    );
  }
}

// Créer toutes les tables
async function createTables() {
  const client = await pool.connect();

  try {
    // Table des utilisateurs
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        avatar_url VARCHAR(255),
        bio TEXT,
        location VARCHAR(100),
        is_event_creator BOOLEAN DEFAULT FALSE,
        rating_average DECIMAL(3,2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        badges TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des événements
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        location_address VARCHAR(255) NOT NULL,
        location_city VARCHAR(100) NOT NULL,
        location_coordinates POINT,
        date_start TIMESTAMP NOT NULL,
        date_end TIMESTAMP NOT NULL,
        capacity INTEGER NOT NULL,
        current_attendees INTEGER DEFAULT 0,
        price_amount DECIMAL(10,2) DEFAULT 0,
        price_currency VARCHAR(3) DEFAULT 'EUR',
        price_is_free BOOLEAN DEFAULT TRUE,
        images TEXT[] DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active',
        rating_average DECIMAL(3,2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        photos TEXT[] DEFAULT '{}',
        is_featured BOOLEAN DEFAULT FALSE,
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des inscriptions aux événements
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'confirmed',
        UNIQUE(event_id, user_id)
      )
    `);

    // Table des notes/évaluations avec nouveau système intelligent
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Note principale
        overall_rating DECIMAL(3,2) NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
        
        -- Timing de présence
        arrival_time TIME,
        departure_time TIME,
        still_present BOOLEAN DEFAULT FALSE,
        
        -- Tags rapides (JSON array)
        quick_tags JSONB DEFAULT '[]',
        
        -- Critères détaillés (JSON object avec scores)
        detailed_criteria JSONB DEFAULT '{}',
        
        -- Informations contextuelles
        crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5),
        weather_conditions VARCHAR(100),
        
        -- Commentaire et métadonnées
        comment TEXT,
        rating_metadata JSONB DEFAULT '{}',
        
        -- Ancien système (pour compatibilité)
        ambiance_rating DECIMAL(3,2) CHECK (ambiance_rating >= 1 AND ambiance_rating <= 5),
        affluence_rating DECIMAL(3,2) CHECK (affluence_rating >= 1 AND affluence_rating <= 5),
        organisation_rating DECIMAL(3,2) CHECK (organisation_rating >= 1 AND organisation_rating <= 5),
        quality_rating DECIMAL(3,2) CHECK (quality_rating >= 1 AND quality_rating <= 5),
        value_rating DECIMAL(3,2) CHECK (value_rating >= 1 AND value_rating <= 5),
        noise_level DECIMAL(3,2) CHECK (noise_level >= 1 AND noise_level <= 5),
        visual_quality DECIMAL(3,2) CHECK (visual_quality >= 1 AND visual_quality <= 5),
        comfort_rating DECIMAL(3,2) CHECK (comfort_rating >= 1 AND comfort_rating <= 5),
        accessibility_rating DECIMAL(3,2) CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5),
        security_rating DECIMAL(3,2) CHECK (security_rating >= 1 AND security_rating <= 5),
        services_rating DECIMAL(3,2) CHECK (services_rating >= 1 AND services_rating <= 5),
        attendance_time VARCHAR(50),
        
        -- Métadonnées système
        photos TEXT[] DEFAULT '{}',
        is_anonymous BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        helpful_count INTEGER DEFAULT 0,
        report_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);

    // Table des sessions utilisateur
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table pour l'historique des événements (événements récurrents)
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_history (
        id SERIAL PRIMARY KEY,
        event_series_id VARCHAR(100) NOT NULL, -- Identifiant pour regrouper les éditions
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        edition_year INTEGER NOT NULL,
        edition_number INTEGER NOT NULL,
        attendance_count INTEGER DEFAULT 0,
        average_rating DECIMAL(3,2) DEFAULT 0,
        rating_count INTEGER DEFAULT 0,
        highlights TEXT[] DEFAULT '{}',
        issues TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table pour détecter les doublons d'événements
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_similarity (
        id SERIAL PRIMARY KEY,
        event1_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        event2_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        similarity_score DECIMAL(3,2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
        similarity_reasons TEXT[] DEFAULT '{}',
        is_duplicate BOOLEAN DEFAULT FALSE,
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event1_id, event2_id)
      )
    `);

    // Table pour les favoris des utilisateurs
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, event_id)
      )
    `);

    // Index pour optimiser les performances
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
      CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_city);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date_start);
      CREATE INDEX IF NOT EXISTS idx_events_rating ON events(rating_average DESC);
      CREATE INDEX IF NOT EXISTS idx_events_creator ON events(creator_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_event ON ratings(event_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
      CREATE INDEX IF NOT EXISTS idx_registrations_event ON event_registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_registrations_user ON event_registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_event_history_series ON event_history(event_series_id);
      CREATE INDEX IF NOT EXISTS idx_event_similarity_score ON event_similarity(similarity_score DESC);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
    `);

    // Mettre à jour la table ratings existante si nécessaire
    try {
      // Forcer le bon type pour les colonnes existantes
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN overall_rating TYPE DECIMAL(3,2)`
      );
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN ambiance_rating TYPE DECIMAL(3,2)`
      );
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN affluence_rating TYPE DECIMAL(3,2)`
      );
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN organisation_rating TYPE DECIMAL(3,2)`
      );
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN quality_rating TYPE DECIMAL(3,2)`
      );
      await client.query(
        `ALTER TABLE ratings ALTER COLUMN value_rating TYPE DECIMAL(3,2)`
      );

      // Ajouter les nouvelles colonnes
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS noise_level DECIMAL(3,2) CHECK (noise_level >= 1 AND noise_level <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS visual_quality DECIMAL(3,2) CHECK (visual_quality >= 1 AND visual_quality <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS comfort_rating DECIMAL(3,2) CHECK (comfort_rating >= 1 AND comfort_rating <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS accessibility_rating DECIMAL(3,2) CHECK (accessibility_rating >= 1 AND accessibility_rating <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS security_rating DECIMAL(3,2) CHECK (security_rating >= 1 AND security_rating <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS services_rating DECIMAL(3,2) CHECK (services_rating >= 1 AND services_rating <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS attendance_time VARCHAR(50)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS crowd_level DECIMAL(3,2) CHECK (crowd_level >= 1 AND crowd_level <= 5)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS weather_conditions VARCHAR(100)`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`
      );
      await client.query(
        `ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
      );
      console.log("✅ Table ratings mise à jour avec les nouvelles colonnes");
    } catch (error) {
      console.log("ℹ️ Table ratings déjà à jour");
    }

    // Ajouter la colonne photos aux événements existants
    try {
      await client.query(
        `ALTER TABLE events ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'`
      );
      console.log("✅ Colonne photos ajoutée aux événements");
    } catch (error) {
      console.log("ℹ️ Colonne photos déjà présente");
    }

    // Migrer la table ratings vers le nouveau système intelligent
    try {
      // Ajouter les nouvelles colonnes pour le système intelligent
      await client.query(`
        ALTER TABLE ratings 
        ADD COLUMN IF NOT EXISTS arrival_time TIME,
        ADD COLUMN IF NOT EXISTS departure_time TIME,
        ADD COLUMN IF NOT EXISTS still_present BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS quick_tags JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS detailed_criteria JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS rating_metadata JSONB DEFAULT '{}';
      `);
      
      // Modifier crowd_level pour être INTEGER au lieu de DECIMAL si nécessaire
      await client.query(`
        ALTER TABLE ratings ALTER COLUMN crowd_level TYPE INTEGER USING crowd_level::INTEGER;
      `);
      
      console.log("✅ Table ratings migrée vers le système intelligent");
    } catch (error) {
      console.log("ℹ️ Table ratings déjà migrée:", error.message);
    }

    console.log("✅ Tables créées avec succès sur Supabase");
  } finally {
    client.release();
  }
}

// Fonctions utilitaires pour la base de données
const db = {
  // Requête simple
  query: (text, params) => pool.query(text, params),

  // Obtenir un client pour les transactions
  getClient: () => pool.connect(),

  // Initialiser la base de données
  init: initDatabase,

  // Fermer la connexion
  close: () => pool.end(),
};

module.exports = db;
