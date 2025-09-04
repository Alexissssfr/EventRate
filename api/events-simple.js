module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Pour l'instant, retournons juste des données statiques
    // Une fois que ça marche, on ajoutera Supabase
    
    const mockEvents = [
      {
        id: 1,
        title: "Événement test",
        date: "2025-01-10",
        time: "14:00",
        location: "Paris",
        description: "Ceci est un test",
        category: "test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    if (req.method === "GET") {
      return res.status(200).json(mockEvents);
    }

    if (req.method === "POST") {
      return res.status(201).json({ 
        message: "Événement créé (mode test)",
        id: Math.floor(Math.random() * 1000)
      });
    }

    return res.status(405).json({ error: "Méthode non autorisée" });

  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({ 
      error: "Erreur serveur",
      details: error.message 
    });
  }
};
