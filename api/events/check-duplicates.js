// Fonction serverless pour la détection de doublons
import { Pool } from 'pg';

const db = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Fonction utilitaire pour calculer la similarité entre deux chaînes
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Normaliser les chaînes (minuscules, sans accents, sans espaces multiples)
  const normalize = (str) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
      .replace(/\s+/g, " ")
      .trim();

  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 100;

  // Distance de Levenshtein simplifiée
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const distance = levenshteinDistance(longer, shorter);
  return Math.round(((longer.length - distance) / longer.length) * 100);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export default async function handler(req, res) {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { title, date_start, location_city } = req.query;

    if (!title) {
      return res.status(400).json({ error: "Le titre est requis" });
    }

    // Rechercher les événements similaires
    const query = `
      SELECT id, title, date_start, date_end, location_city, location_address, description
      FROM events 
      ORDER BY date_start ASC
    `;

    const result = await db.query(query);
    const events = result.rows;

    const duplicates = [];

    events.forEach((event) => {
      const titleSimilarity = calculateSimilarity(title, event.title);

      // Calculer la différence de dates si fournie
      let dateDiff = null;
      if (date_start && event.date_start) {
        const inputDate = new Date(date_start);
        const eventDate = new Date(event.date_start);
        dateDiff = Math.abs(inputDate - eventDate) / (1000 * 60 * 60 * 24); // différence en jours
      }

      // Vérifier la similarité de la ville
      let citySimilarity = 0;
      if (location_city && event.location_city) {
        citySimilarity = calculateSimilarity(
          location_city,
          event.location_city
        );
      }

      // Critères de détection de doublons
      let confidence = 0;
      let reason = "";

      if (
        titleSimilarity === 100 &&
        citySimilarity >= 90 &&
        dateDiff !== null &&
        dateDiff <= 1
      ) {
        confidence = 95;
        reason = "Titre identique, même ville et même date";
      } else if (
        titleSimilarity >= 85 &&
        citySimilarity >= 90 &&
        dateDiff !== null &&
        dateDiff <= 3
      ) {
        confidence = 80;
        reason = "Titre très similaire, même ville et date proche";
      } else if (titleSimilarity >= 70 && dateDiff !== null && dateDiff === 0) {
        confidence = 70;
        reason = "Titre similaire et même date exacte";
      } else if (titleSimilarity >= 60 && citySimilarity >= 90) {
        confidence = 50;
        reason = "Titre similaire et même ville";
      } else if (titleSimilarity >= 60) {
        confidence = 40;
        reason = "Titre similaire";
      }

      if (confidence >= 50) {
        duplicates.push({
          id: event.id,
          title: event.title,
          date_start: event.date_start,
          date_end: event.date_end,
          location_city: event.location_city,
          location_address: event.location_address,
          description: event.description,
          confidence,
          reason,
          titleSimilarity,
          citySimilarity,
          dateDiff,
        });
      }
    });

    // Trier par niveau de confiance décroissant
    duplicates.sort((a, b) => b.confidence - a.confidence);

    res.json({
      duplicates: duplicates.slice(0, 5), // Limiter à 5 résultats
      total: duplicates.length,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification des doublons:", error);
    res
      .status(500)
      .json({ error: "Erreur serveur lors de la vérification des doublons" });
  }
}
