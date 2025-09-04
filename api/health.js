module.exports = function handler(req, res) {
  res.status(200).json({
    status: "OK",
    message: "API EventRate fonctionne sur Vercel",
    timestamp: new Date().toISOString(),
  });
};
