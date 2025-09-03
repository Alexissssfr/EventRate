# 🚀 Configuration Supabase pour EventRate

## 📋 Étapes de configuration

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Cliquez sur "New Project"
3. Choisissez votre organisation
4. Donnez un nom à votre projet (ex: "eventrate")
5. Créez un mot de passe pour la base de données
6. Choisissez une région (Europe pour de meilleures performances en France)
7. Cliquez sur "Create new project"

### 2. Récupérer les informations de connexion

1. Dans votre projet Supabase, allez dans **Settings** > **Database**
2. Copiez les informations suivantes :
   - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: (celui que vous avez créé)

### 3. Configurer les variables d'environnement

1. Copiez le fichier `server/env.example` vers `server/.env` :
   ```bash
   cp server/env.example server/.env
   ```

2. Modifiez `server/.env` avec vos informations Supabase :
   ```env
   SUPABASE_DB_USER=postgres
   SUPABASE_DB_HOST=db.xxxxxxxxxxxxx.supabase.co
   SUPABASE_DB_NAME=postgres
   SUPABASE_DB_PASSWORD=votre-mot-de-passe
   SUPABASE_DB_PORT=5432
   ```

### 4. Démarrer le serveur

```bash
cd server
node server.js
```

## 🔧 Configuration avancée

### Row Level Security (RLS)

Pour activer la sécurité au niveau des lignes dans Supabase :

1. Allez dans **Authentication** > **Policies**
2. Activez RLS sur chaque table
3. Créez des politiques personnalisées

### Exemple de politique pour les événements :

```sql
-- Permettre la lecture publique des événements actifs
CREATE POLICY "Events are viewable by everyone" ON events
FOR SELECT USING (status = 'active');

-- Permettre la création d'événements aux utilisateurs connectés
CREATE POLICY "Users can create events" ON events
FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Permettre la modification de ses propres événements
CREATE POLICY "Users can update own events" ON events
FOR UPDATE USING (auth.uid() = creator_id);
```

## 📊 Monitoring

- **Dashboard**: Voir les statistiques dans Supabase Dashboard
- **Logs**: Vérifier les requêtes dans **Database** > **Logs**
- **Performance**: Surveiller les performances dans **Database** > **Performance**

## 🔒 Sécurité

- ✅ SSL activé par défaut
- ✅ Connexions sécurisées
- ✅ Authentification JWT
- ✅ Rate limiting
- ✅ Validation des données

## 🚀 Déploiement

Pour déployer en production :

1. Créez un nouveau projet Supabase pour la production
2. Configurez les variables d'environnement de production
3. Activez les politiques RLS
4. Configurez les sauvegardes automatiques

## 📞 Support

- [Documentation Supabase](https://supabase.com/docs)
- [Discord Supabase](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
