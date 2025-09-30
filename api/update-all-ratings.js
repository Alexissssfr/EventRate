const { Pool } = require("pg");

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  // Configuration CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    console.log("🔄 Début de la mise à jour de toutes les statistiques d'avis...");

    // Récupérer tous les événements
    const eventsResult = await pool.query("SELECT id FROM events");
    const events = eventsResult.rows;

    console.log(`📊 ${events.length} événements trouvés`);

    let updatedCount = 0;
    let errorCount = 0;

    // Pour chaque événement, recalculer les statistiques
    for (const event of events) {
      try {
        // Calculer la moyenne et le nombre d'avis
        const statsResult = await pool.query(
          `SELECT 
            COUNT(*) as rating_count,
            AVG(overall_rating) as rating_average
           FROM ratings 
           WHERE event_id = $1 AND status = 'active'`,
          [event.id]
        );

        const stats = statsResult.rows[0];
        const ratingCount = parseInt(stats.rating_count) || 0;
        const ratingAverage = stats.rating_average ? parseFloat(stats.rating_average) : 0;

        // Mettre à jour la table events
        await pool.query(
          `UPDATE events 
           SET rating_count = $1, rating_average = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [ratingCount, ratingAverage, event.id]
        );

        console.log(`✅ Événement ${event.id}: ${ratingCount} avis, moyenne ${ratingAverage}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Erreur pour l'événement ${event.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`🎉 Mise à jour terminée: ${updatedCount} événements mis à jour, ${errorCount} erreurs`);

    res.status(200).json({
      message: "Mise à jour des statistiques terminée",
      updated: updatedCount,
      errors: errorCount,
      total: events.length
    });

  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour des statistiques:", error);
    res.status(500).json({
      error: "Erreur interne du serveur",
      details: error.message,
    });
  }
}
