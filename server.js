require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: "Trop de requêtes depuis cette IP, veuillez réessayer plus tard.",
});
app.use("/api/", limiter);

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token d'accès requis" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier si le token existe dans la base de données
    const result = await db.query(
      "SELECT * FROM user_sessions WHERE token = $1 AND expires_at > NOW()",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Token invalide ou expiré" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token invalide" });
  }
};

// Routes d'authentification
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Email ou nom d'utilisateur déjà utilisé" });
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, first_name, last_name`,
      [username, email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Créer un token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Sauvegarder la session
    await db.query(
      "INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
      [user.id, token]
    );

    res.status(201).json({
      message: "Compte créé avec succès",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ error: "Erreur lors de la création du compte" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Créer un token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Sauvegarder la session
    await db.query(
      "INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
      [user.id, token]
    );

    res.json({
      message: "Connexion réussie",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isEventCreator: user.is_event_creator,
        ratingAverage: user.rating_average,
        ratingCount: user.rating_count,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({ error: "Erreur lors de la connexion" });
  }
});

app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    const token = req.headers["authorization"].split(" ")[1];

    // Supprimer la session
    await db.query("DELETE FROM user_sessions WHERE token = $1", [token]);

    res.json({ message: "Déconnexion réussie" });
  } catch (error) {
    console.error("Erreur lors de la déconnexion:", error);
    res.status(500).json({ error: "Erreur lors de la déconnexion" });
  }
});

// Routes des événements
// Récupérer un événement par ID

app.get("/api/events", async (req, res) => {
  try {
    const { category, city, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT e.*, u.username as creator_username, u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      WHERE e.status = 'active'
    `;
    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND e.category = $${paramCount}`;
      params.push(category);
    }

    if (city) {
      paramCount++;
      query += ` AND e.location_city ILIKE $${paramCount}`;
      params.push(`%${city}%`);
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramCount + 1} OFFSET $${
      paramCount + 2
    }`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Compter le total pour la pagination
    let countQuery = "SELECT COUNT(*) FROM events WHERE status = 'active'";
    const countParams = [];
    paramCount = 0;

    if (category) {
      paramCount++;
      countQuery += ` AND category = $${paramCount}`;
      countParams.push(category);
    }

    if (city) {
      paramCount++;
      countQuery += ` AND location_city ILIKE $${paramCount}`;
      countParams.push(`%${city}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      events: result.rows.map((event) => ({
        _id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        location: {
          address: event.location_address,
          city: event.location_city,
          coordinates: event.location_coordinates
            ? [event.location_coordinates.x, event.location_coordinates.y]
            : null,
        },
        date: {
          start: event.date_start,
          end: event.date_end,
        },
        capacity: event.capacity,
        currentAttendees: event.current_attendees,
        price: {
          amount: event.price_amount,
          currency: event.price_currency,
          isFree: event.price_is_free,
        },
        rating: {
          average: parseFloat(event.rating_average) || 0,
          count: event.rating_count,
        },
        photos: event.photos || [], // Ajouter les photos
        creator: {
          username: event.creator_username,
          firstName: event.creator_first_name,
          lastName: event.creator_last_name,
        },
        isFeatured: event.is_featured,
        views: event.views_count,
        createdAt: event.created_at,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des événements:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des événements" });
  }
});

app.post("/api/events", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      locationAddress,
      locationCity,
      dateStart,
      dateEnd,
      capacity,
      priceAmount,
      priceIsFree,
      tags,
    } = req.body;

    const result = await db.query(
      `INSERT INTO events (
        title, description, category, creator_id, location_address, location_city,
        date_start, date_end, capacity, price_amount, price_is_free, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        title,
        description,
        category,
        req.user.userId,
        locationAddress,
        locationCity,
        dateStart,
        dateEnd,
        capacity,
        priceAmount || 0,
        priceIsFree,
        tags || [],
      ]
    );

    const event = result.rows[0];
    res.status(201).json({
      message: "Événement créé avec succès",
      event: {
        _id: event.id,
        title: event.title,
        description: event.description,
        category: event.category,
        location: {
          address: event.location_address,
          city: event.location_city,
        },
        date: {
          start: event.date_start,
          end: event.date_end,
        },
        capacity: event.capacity,
        price: {
          amount: event.price_amount,
          isFree: event.price_is_free,
        },
      },
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'événement:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la création de l'événement" });
  }
});

// Routes des inscriptions aux événements
app.post(
  "/api/events/:eventId/register",
  authenticateToken,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user.userId;

      // Vérifier si l'événement existe et a de la place
      const eventResult = await db.query(
        "SELECT * FROM events WHERE id = $1 AND status = 'active'",
        [eventId]
      );

      if (eventResult.rows.length === 0) {
        return res.status(404).json({ error: "Événement non trouvé" });
      }

      const event = eventResult.rows[0];
      if (event.current_attendees >= event.capacity) {
        return res.status(400).json({ error: "Événement complet" });
      }

      // Vérifier si l'utilisateur est déjà inscrit
      const existingRegistration = await db.query(
        "SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );

      if (existingRegistration.rows.length > 0) {
        return res
          .status(400)
          .json({ error: "Vous êtes déjà inscrit à cet événement" });
      }

      // Inscrire l'utilisateur
      await db.query(
        "INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)",
        [eventId, userId]
      );

      // Mettre à jour le nombre d'inscrits
      await db.query(
        "UPDATE events SET current_attendees = current_attendees + 1 WHERE id = $1",
        [eventId]
      );

      res.json({ message: "Inscription réussie" });
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      res.status(500).json({ error: "Erreur lors de l'inscription" });
    }
  }
);

// Routes des notes/évaluations - DÉPLACÉ vers api/ratings.js (Vercel)

// Fonction pour mettre à jour la note moyenne d'un événement
async function updateEventRating(eventId) {
  const result = await db.query(
    `SELECT AVG(overall_rating) as average, COUNT(*) as count
     FROM ratings WHERE event_id = $1 AND status = 'active'`,
    [parseInt(eventId)]
  );

  const { average, count } = result.rows[0];

  await db.query(
    "UPDATE events SET rating_average = $1, rating_count = $2 WHERE id = $3",
    [parseFloat(average) || 0, parseInt(count) || 0, parseInt(eventId)]
  );
}

// ===== NOUVELLES ROUTES AVANCÉES =====

// Système de notation intelligent
app.post("/api/ratings/detailed", authenticateToken, async (req, res) => {
  try {
    const {
      eventId,
      overallRating,
      presenceTiming,
      quickTags = [],
      detailedCriteria = {},
      contextInfo = {},
      comment = "",
      ratingMetadata = {},
    } = req.body;

    const userId = req.user.userId;

    console.log("Notation intelligente reçue:", {
      eventId,
      overallRating,
      presenceTiming,
      quickTags,
      detailedCriteria,
      contextInfo,
      ratingMetadata,
    });

    // Vérifier que l'utilisateur a participé à l'événement (optionnel - on peut noter sans s'inscrire)
    const participationCheck = await db.query(
      "SELECT * FROM event_registrations WHERE event_id = $1 AND user_id = $2",
      [parseInt(eventId), userId]
    );

    const isRegistered = participationCheck.rows.length > 0;

    // Préparer les données de timing
    const arrivalTime = presenceTiming?.arrivalTime || null;
    const departureTime = presenceTiming?.stillPresent
      ? null
      : presenceTiming?.departureTime || null;
    const stillPresent = presenceTiming?.stillPresent || false;

    // Préparer les données contextuelles
    const crowdLevel = contextInfo?.crowdLevel || null;
    const weatherConditions = contextInfo?.weatherConditions || null;

    // Enrichir les métadonnées
    const enrichedMetadata = {
      ...ratingMetadata,
      isRegistered,
      submissionSource: "web",
      version: "2.0",
    };

    // Insérer la notation avec le nouveau système
    const result = await db.query(
      `
      INSERT INTO ratings (
        event_id, user_id, overall_rating,
        arrival_time, departure_time, still_present,
        quick_tags, detailed_criteria,
        crowd_level, weather_conditions,
        comment, rating_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (event_id, user_id) 
      DO UPDATE SET
        overall_rating = EXCLUDED.overall_rating,
        arrival_time = EXCLUDED.arrival_time,
        departure_time = EXCLUDED.departure_time,
        still_present = EXCLUDED.still_present,
        quick_tags = EXCLUDED.quick_tags,
        detailed_criteria = EXCLUDED.detailed_criteria,
        crowd_level = EXCLUDED.crowd_level,
        weather_conditions = EXCLUDED.weather_conditions,
        comment = EXCLUDED.comment,
        rating_metadata = EXCLUDED.rating_metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [
        parseInt(eventId),
        userId,
        parseFloat(overallRating),
        arrivalTime,
        departureTime,
        stillPresent,
        JSON.stringify(quickTags),
        JSON.stringify(detailedCriteria),
        crowdLevel,
        weatherConditions,
        comment,
        JSON.stringify(enrichedMetadata),
      ]
    );

    // Mettre à jour la note moyenne de l'événement
    await updateEventRating(parseInt(eventId));

    // Préparer la réponse avec parsing sécurisé
    const ratingResult = result.rows[0];
    let parsedQuickTags = [];
    let parsedDetailedCriteria = {};
    let parsedRatingMetadata = {};

    try {
      parsedQuickTags =
        typeof ratingResult.quick_tags === "string"
          ? JSON.parse(ratingResult.quick_tags)
          : ratingResult.quick_tags || [];
    } catch (e) {
      console.warn("Erreur parsing quick_tags:", e.message);
      parsedQuickTags = [];
    }

    try {
      parsedDetailedCriteria =
        typeof ratingResult.detailed_criteria === "string"
          ? JSON.parse(ratingResult.detailed_criteria)
          : ratingResult.detailed_criteria || {};
    } catch (e) {
      console.warn("Erreur parsing detailed_criteria:", e.message);
      parsedDetailedCriteria = {};
    }

    try {
      parsedRatingMetadata =
        typeof ratingResult.rating_metadata === "string"
          ? JSON.parse(ratingResult.rating_metadata)
          : ratingResult.rating_metadata || {};
    } catch (e) {
      console.warn("Erreur parsing rating_metadata:", e.message);
      parsedRatingMetadata = {};
    }

    res.json({
      message: "Notation intelligente enregistrée avec succès",
      rating: {
        ...ratingResult,
        quick_tags: parsedQuickTags,
        detailed_criteria: parsedDetailedCriteria,
        rating_metadata: parsedRatingMetadata,
      },
      summary: {
        hasQuickTags: quickTags.length > 0,
        hasDetailedCriteria: Object.keys(detailedCriteria).length > 0,
        presenceDuration:
          arrivalTime && departureTime ? "Définie" : "Indéfinie",
        contextProvided: !!(crowdLevel || weatherConditions),
      },
    });
  } catch (error) {
    console.error("Erreur lors de la notation intelligente:", error);
    res.status(500).json({
      error: "Erreur lors de l'enregistrement de la notation",
      details: error.message,
    });
  }
});

// Vérifier les doublons lors de la création d'événement
app.post(
  "/api/events/check-duplicates",
  authenticateToken,
  async (req, res) => {
    try {
      const { title, locationCity, dateStart, category } = req.body;

      // Rechercher des événements similaires
      const similarEvents = await db.query(
        `
      SELECT 
        e.*,
        u.username as creator_username,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM events e
      JOIN users u ON e.creator_id = u.id
      WHERE 
        e.status = 'active' AND
        (
          e.title ILIKE $1 OR
          e.location_city ILIKE $2 OR
          (e.category = $3 AND ABS(EXTRACT(EPOCH FROM (e.date_start - $4::timestamp))/86400) <= 30)
        )
      ORDER BY e.created_at DESC
      LIMIT 5
    `,
        [`%${title}%`, `%${locationCity}%`, category, dateStart]
      );

      const duplicates = similarEvents.rows.filter((event) => {
        const titleSimilar =
          event.title.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(event.title.toLowerCase());
        const locationSimilar = event.location_city
          .toLowerCase()
          .includes(locationCity.toLowerCase());
        const dateSimilar =
          Math.abs(new Date(event.date_start) - new Date(dateStart)) <
          30 * 24 * 60 * 60 * 1000;

        return titleSimilar && (locationSimilar || dateSimilar);
      });

      res.json({
        hasDuplicates: duplicates.length > 0,
        similarEvents: duplicates,
        message:
          duplicates.length > 0
            ? `Nous avons trouvé ${duplicates.length} événement(s) similaire(s). Vérifiez s'il ne s'agit pas d'un doublon.`
            : "Aucun événement similaire trouvé.",
      });
    } catch (error) {
      console.error("Erreur lors de la vérification des doublons:", error);
      res
        .status(500)
        .json({ error: "Erreur lors de la vérification des doublons" });
    }
  }
);

// Modifier un événement
app.put("/api/events/:eventId", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    // Vérifier que l'utilisateur est le créateur de l'événement
    const eventCheck = await db.query(
      "SELECT * FROM events WHERE id = $1 AND creator_id = $2",
      [eventId, userId]
    );

    if (eventCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Vous ne pouvez modifier que vos propres événements" });
    }

    // Construire la requête de mise à jour
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateData).forEach((key) => {
      if (key !== "id" && key !== "creator_id" && key !== "created_at") {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour" });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(eventId);

    const query = `
      UPDATE events 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);

    res.json({
      message: "Événement mis à jour avec succès",
      event: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur lors de la modification de l'événement:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la modification de l'événement" });
  }
});

// Supprimer un événement
app.delete("/api/events/:eventId", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // Vérifier que l'utilisateur est le créateur de l'événement
    const eventCheck = await db.query(
      "SELECT * FROM events WHERE id = $1 AND creator_id = $2",
      [eventId, userId]
    );

    if (eventCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Vous ne pouvez supprimer que vos propres événements" });
    }

    // Supprimer l'événement (cascade automatique grâce aux foreign keys)
    await db.query("DELETE FROM events WHERE id = $1", [eventId]);

    res.json({ message: "Événement supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'événement:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de l'événement" });
  }
});

// Route pour mettre à jour les photos d'un événement via URLs
app.post("/api/events/:eventId/photos", authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { photoUrls } = req.body;
    const userId = req.user.userId;

    console.log(
      "Mise à jour photos - eventId:",
      eventId,
      "userId:",
      userId,
      "URLs:",
      photoUrls
    );

    // Vérifier que l'événement existe et appartient à l'utilisateur
    const eventCheck = await db.query(
      "SELECT * FROM events WHERE id = $1 AND creator_id = $2",
      [parseInt(eventId), userId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Événement non trouvé ou vous n'êtes pas autorisé à le modifier",
      });
    }

    // Valider et nettoyer les URLs
    const validPhotoUrls = [];
    if (photoUrls && Array.isArray(photoUrls)) {
      photoUrls.forEach((url) => {
        if (url && typeof url === "string" && url.trim().length > 0) {
          // Vérification basique d'URL
          try {
            new URL(url.trim());
            validPhotoUrls.push(url.trim());
          } catch (error) {
            console.log("URL invalide ignorée:", url);
          }
        }
      });
    }

    console.log("URLs validées:", validPhotoUrls);

    // Mettre à jour les photos de l'événement
    await db.query("UPDATE events SET photos = $1 WHERE id = $2", [
      validPhotoUrls,
      parseInt(eventId),
    ]);

    res.json({
      message: "Photos mises à jour avec succès",
      photos: validPhotoUrls,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour des photos:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour des photos" });
  }
});

// Route pour récupérer les avis d'un événement
app.get("/api/events/:eventId/ratings", async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await db.query(
      `
      SELECT 
        r.*,
        u.username,
        u.first_name,
        u.last_name
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = $1 AND r.status = 'active'
      ORDER BY r.created_at DESC
    `,
      [eventId]
    );

    res.json({ ratings: result.rows });
  } catch (error) {
    console.error("Erreur lors de la récupération des avis:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des avis" });
  }
});

// Routes pour la gestion des avis utilisateur

// Obtenir tous les avis d'un utilisateur
// Récupérer les événements créés par un utilisateur
app.get("/api/users/:userId/events", async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'utilisateur demande ses propres événements
    if (decoded.userId !== parseInt(userId)) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }

    const result = await db.query(
      `SELECT id, title, description, location_address, location_city, date_start, date_end, 
              category, capacity, price_amount, price_is_free, photos, created_at, creator_id as user_id
       FROM events
       WHERE creator_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // Parser les photos JSON et mapper les colonnes
    const events = result.rows.map((event) => ({
      ...event,
      location:
        event.location_address +
        (event.location_city ? `, ${event.location_city}` : ""),
      max_participants: event.capacity,
      price: event.price_is_free ? 0 : event.price_amount,
      photos: event.photos
        ? typeof event.photos === "string"
          ? JSON.parse(event.photos)
          : event.photos
        : [],
    }));

    res.json(events);
  } catch (error) {
    console.error("Erreur récupération événements utilisateur:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }

    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Endpoint pour détecter les doublons potentiels - DOIT être avant /api/events/:eventId
app.get("/api/events/check-duplicates", async (req, res) => {
  try {
    const { title, date_start, location_city } = req.query;

    console.log("Paramètres reçus:", { title, date_start, location_city });

    if (!title) {
      return res.status(400).json({ error: "Le titre est requis" });
    }

    // Rechercher les événements similaires
    const query = `
      SELECT id, title, date_start, date_end, location_city, location_address, description
      FROM events 
      ORDER BY date_start ASC
    `;

    console.log("Exécution de la requête:", query);
    const result = await db.query(query);
    console.log("Nombre d'événements trouvés:", result.rows.length);
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
});

// Récupérer un événement spécifique
app.get("/api/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await db.query(
      `SELECT id, title, description, location_address, location_city, date_start, date_end, 
              category, capacity, price_amount, price_is_free, photos, created_at, creator_id
       FROM events
       WHERE id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Événement non trouvé" });
    }

    const event = result.rows[0];

    // Parser les photos JSON
    event.photos = event.photos
      ? typeof event.photos === "string"
        ? JSON.parse(event.photos)
        : event.photos
      : [];

    res.json(event);
  } catch (error) {
    console.error("Erreur récupération événement:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Modifier un événement
app.put("/api/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      title,
      description,
      category,
      location_address,
      location_city,
      date_start,
      date_end,
      capacity,
      price_is_free,
      price_amount,
      photos,
    } = req.body;

    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'utilisateur est le créateur de l'événement
    const checkResult = await db.query(
      "SELECT creator_id FROM events WHERE id = $1",
      [eventId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Événement non trouvé" });
    }

    if (checkResult.rows[0].creator_id !== decoded.userId) {
      return res
        .status(403)
        .json({ error: "Vous n'êtes pas autorisé à modifier cet événement" });
    }

    // Mettre à jour l'événement
    const result = await db.query(
      `UPDATE events SET 
        title = $1, description = $2, category = $3, location_address = $4, location_city = $5,
        date_start = $6, date_end = $7, capacity = $8, price_is_free = $9, price_amount = $10, photos = $11
       WHERE id = $12
       RETURNING *`,
      [
        title,
        description,
        category,
        location_address,
        location_city,
        date_start,
        date_end,
        capacity,
        price_is_free,
        price_amount,
        JSON.stringify(photos),
        eventId,
      ]
    );

    const updatedEvent = result.rows[0];

    // Parser les photos JSON pour la réponse
    updatedEvent.photos = updatedEvent.photos
      ? typeof updatedEvent.photos === "string"
        ? JSON.parse(updatedEvent.photos)
        : updatedEvent.photos
      : [];

    res.json({
      message: "Événement modifié avec succès",
      event: updatedEvent,
    });
  } catch (error) {
    console.error("Erreur modification événement:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }

    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/users/:userId/ratings", async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'utilisateur demande ses propres avis
    if (decoded.userId !== parseInt(userId)) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }

    const query = `
      SELECT 
        r.*,
        e.title as event_title,
        e.date_start as event_date
      FROM ratings r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `;

    const result = await db.query(query, [userId]);

    // Parser les champs JSONB
    const ratings = result.rows.map((rating) => ({
      ...rating,
      quick_tags:
        typeof rating.quick_tags === "string"
          ? rating.quick_tags
            ? JSON.parse(rating.quick_tags)
            : []
          : rating.quick_tags || [],
      detailed_criteria:
        typeof rating.detailed_criteria === "string"
          ? rating.detailed_criteria
            ? JSON.parse(rating.detailed_criteria)
            : {}
          : rating.detailed_criteria || {},
      rating_metadata:
        typeof rating.rating_metadata === "string"
          ? rating.rating_metadata
            ? JSON.parse(rating.rating_metadata)
            : {}
          : rating.rating_metadata || {},
    }));

    res.json({ ratings });
  } catch (error) {
    console.error("Erreur récupération avis utilisateur:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des avis" });
  }
});

// Obtenir un avis spécifique
app.get("/api/ratings/:ratingId", async (req, res) => {
  try {
    const { ratingId } = req.params;

    // Vérifier l'authentification
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Token d'authentification requis" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const query = `
      SELECT 
        r.*,
        e.title as event_title
      FROM ratings r
      JOIN events e ON r.event_id = e.id
      WHERE r.id = $1 AND r.user_id = $2
    `;

    const result = await db.query(query, [ratingId, decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Avis non trouvé" });
    }

    const rating = result.rows[0];

    // Parser les champs JSONB
    const parsedRating = {
      ...rating,
      quick_tags:
        typeof rating.quick_tags === "string"
          ? rating.quick_tags
            ? JSON.parse(rating.quick_tags)
            : []
          : rating.quick_tags || [],
      detailed_criteria:
        typeof rating.detailed_criteria === "string"
          ? rating.detailed_criteria
            ? JSON.parse(rating.detailed_criteria)
            : {}
          : rating.detailed_criteria || {},
      rating_metadata:
        typeof rating.rating_metadata === "string"
          ? rating.rating_metadata
            ? JSON.parse(rating.rating_metadata)
            : {}
          : rating.rating_metadata || {},
    };

    res.json({ rating: parsedRating });
  } catch (error) {
    console.error("Erreur récupération avis:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'avis" });
  }
});

// Modifier un avis - DÉPLACÉ vers api/ratings.js (Vercel)

// Supprimer un avis - DÉPLACÉ vers api/ratings.js (Vercel)

// Route de santé
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "EventRate API fonctionne !",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
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

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

// Démarrer le serveur
async function startServer() {
  try {
    // Initialiser la base de données
    await db.init();

    app.listen(PORT, () => {
      console.log(`🚀 Serveur EventRate démarré sur le port ${PORT}`);
      console.log(`📱 API disponible sur http://localhost:${PORT}/api`);
      console.log(`🔗 Test: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Erreur lors du démarrage du serveur:", error);
    process.exit(1);
  }
}

startServer();
