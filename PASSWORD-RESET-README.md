# 🔑 API de Récupération de Mot de Passe

## 📋 Vue d'ensemble

L'API de récupération de mot de passe permet aux utilisateurs de réinitialiser leur mot de passe en toute sécurité via un système de tokens temporaires.

## 🚀 Installation

### 1. Créer la table de base de données

Exécutez le script SQL suivant dans votre base de données PostgreSQL :

```sql
-- Exécuter le contenu de database-password-reset.sql
```

### 2. Variables d'environnement

Assurez-vous que ces variables sont définies dans votre environnement Vercel :

```env
DATABASE_URL=postgresql://...
FRONTEND_URL=https://votre-domaine.com
NODE_ENV=production
```

## 📡 Endpoints API

### 1. Demander une réinitialisation

**POST** `/api/auth/forgot-password`

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Réponse (200):**
```json
{
  "message": "Si cet email existe dans notre système, vous recevrez un lien de réinitialisation."
}
```

**Réponse (400):**
```json
{
  "error": "Email requis"
}
```

### 2. Réinitialiser le mot de passe

**POST** `/api/auth/reset-password`

**Body:**
```json
{
  "token": "abc123...",
  "newPassword": "nouveau_mot_de_passe"
}
```

**Réponse (200):**
```json
{
  "message": "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe."
}
```

**Réponse (400):**
```json
{
  "error": "Token invalide ou expiré. Veuillez demander un nouveau lien de réinitialisation."
}
```

## 🔒 Sécurité

- **Tokens uniques** : Chaque token est généré de manière cryptographiquement sécurisée
- **Expiration** : Les tokens expirent après 1 heure
- **Usage unique** : Chaque token ne peut être utilisé qu'une seule fois
- **Validation** : Vérification de la force du mot de passe (minimum 6 caractères)
- **Hachage** : Les mots de passe sont hachés avec bcrypt (10 rounds)

## 📧 Envoi d'emails

### En développement
- Les liens de réinitialisation sont affichés dans la console
- Aucun email réel n'est envoyé

### En production
Pour implémenter l'envoi d'emails réels, vous devez :

1. **Choisir un service d'email** (SendGrid, Mailgun, AWS SES, etc.)
2. **Modifier l'API** `forgot-password.js` pour envoyer de vrais emails
3. **Créer un template d'email** professionnel

Exemple avec SendGrid :
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: user.email,
  from: 'noreply@votre-domaine.com',
  subject: 'Réinitialisation de votre mot de passe',
  html: `
    <h2>Réinitialisation de mot de passe</h2>
    <p>Bonjour ${user.first_name},</p>
    <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
    <a href="${resetLink}">Réinitialiser mon mot de passe</a>
    <p>Ce lien expire dans 1 heure.</p>
  `
};

await sgMail.send(msg);
```

## 🧪 Test

### 1. Demander une réinitialisation
```bash
curl -X POST https://votre-domaine.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 2. Réinitialiser le mot de passe
```bash
curl -X POST https://votre-domaine.com/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "votre_token", "newPassword": "nouveau_mdp"}'
```

## 🔧 Dépannage

### Erreur "Token invalide"
- Vérifiez que le token n'a pas expiré (1 heure max)
- Vérifiez que le token n'a pas déjà été utilisé
- Vérifiez que le token est correctement copié

### Erreur "Email requis"
- Vérifiez que l'email est fourni dans le body de la requête
- Vérifiez le format de l'email

### Erreur de base de données
- Vérifiez que la table `password_reset_tokens` existe
- Vérifiez la connexion à la base de données
- Vérifiez les permissions de la base de données

## 📱 Frontend

Le frontend gère automatiquement :
- ✅ Détection du token dans l'URL
- ✅ Pré-remplissage du formulaire
- ✅ Validation côté client
- ✅ Redirection après succès
- ✅ Gestion des erreurs

## 🎯 Prochaines étapes

1. **Implémenter l'envoi d'emails** en production
2. **Ajouter un rate limiting** pour éviter le spam
3. **Ajouter des logs** pour le monitoring
4. **Créer des templates d'email** professionnels
5. **Ajouter des tests unitaires**
