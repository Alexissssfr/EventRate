import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CalendarIcon, 
  StarIcon, 
  UserGroupIcon, 
  MapPinIcon,
  ArrowRightIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import { eventAPI, userAPI } from '../services/api';

const Home = () => {
  const { isAuthenticated, user } = useAuth();

  // Récupérer les événements populaires
  const { data: popularEvents } = useQuery(
    ['popular-events'],
    () => eventAPI.getEvents({ limit: 6, sort: 'rating' }),
    { staleTime: 5 * 60 * 1000 }
  );

  // Récupérer les meilleurs créateurs
  const { data: topCreators } = useQuery(
    ['top-creators'],
    () => userAPI.getTopCreators({ limit: 4 }),
    { staleTime: 10 * 60 * 1000 }
  );

  const features = [
    {
      icon: CalendarIcon,
      title: 'Créez des événements',
      description: 'Organisez vos propres événements et gérez-les facilement',
      color: 'bg-primary-500',
    },
    {
      icon: StarIcon,
      title: 'Notez et évaluez',
      description: 'Donnez votre avis sur les événements avec des critères détaillés',
      color: 'bg-warning-500',
    },
    {
      icon: UserGroupIcon,
      title: 'Communauté active',
      description: 'Rejoignez une communauté passionnée d\'événements',
      color: 'bg-success-500',
    },
    {
      icon: MapPinIcon,
      title: 'Géolocalisation',
      description: 'Trouvez des événements près de chez vous',
      color: 'bg-error-500',
    },
  ];

  const categories = [
    { name: 'Musique', icon: '🎵', color: 'bg-purple-500' },
    { name: 'Sport', icon: '⚽', color: 'bg-green-500' },
    { name: 'Business', icon: '💼', color: 'bg-blue-500' },
    { name: 'Culture', icon: '🎭', color: 'bg-yellow-500' },
    { name: 'Food', icon: '🍕', color: 'bg-orange-500' },
    { name: 'Tech', icon: '💻', color: 'bg-indigo-500' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl md:text-6xl font-bold mb-6"
            >
              Découvrez et créez des
              <span className="block text-warning-400">événements incroyables</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl md:text-2xl mb-8 text-primary-100 max-w-3xl mx-auto"
            >
              La plateforme qui révolutionne la création et la découverte d'événements. 
              Notez, partagez et vivez des expériences uniques.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link 
                to="/events" 
                className="btn-lg bg-white text-primary-700 hover:bg-gray-100 inline-flex items-center"
              >
                Découvrir des événements
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              
              {!isAuthenticated && (
                <Link 
                  to="/register" 
                  className="btn-lg bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary-700"
                >
                  Commencer gratuitement
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi choisir EventRate ?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Une plateforme complète pour tous vos besoins événementiels
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${feature.color} text-white mb-6`}>
                  <feature.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Explorez par catégorie
            </h2>
            <p className="text-xl text-gray-600">
              Trouvez des événements qui correspondent à vos intérêts
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className="group cursor-pointer"
              >
                <Link to={`/events?category=${category.name.toLowerCase()}`}>
                  <div className={`${category.color} rounded-lg p-6 text-center text-white group-hover:shadow-lg transition-all duration-200`}>
                    <div className="text-3xl mb-2">{category.icon}</div>
                    <div className="font-semibold">{category.name}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Events Section */}
      {popularEvents?.events?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Événements populaires
                </h2>
                <p className="text-xl text-gray-600">
                  Les événements les mieux notés de la communauté
                </p>
              </div>
              <Link 
                to="/events" 
                className="btn-primary inline-flex items-center"
              >
                Voir tous les événements
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {popularEvents.events.slice(0, 6).map((event, index) => (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                  className="event-card"
                >
                  <Link to={`/events/${event._id}`}>
                    <div className="event-image bg-gray-200 flex items-center justify-center">
                      {event.images?.[0] ? (
                        <img 
                          src={event.images[0].url} 
                          alt={event.images[0].alt || event.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <CalendarIcon className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="event-title">{event.title}</div>
                    <div className="event-description">{event.description}</div>
                    
                    <div className="event-meta">
                      <div className="flex items-center">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        <span>{event.location.city}</span>
                      </div>
                      <div className="flex items-center">
                        <StarIcon className="h-4 w-4 mr-1 text-yellow-500" />
                        <span>{event.rating.average.toFixed(1)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Prêt à créer votre premier événement ?
          </h2>
          <p className="text-xl mb-8 text-primary-100">
            Rejoignez des milliers d'organisateurs qui font confiance à EventRate
          </p>
          
          {!isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/register" 
                className="btn-lg bg-white text-primary-700 hover:bg-gray-100"
              >
                Créer un compte gratuit
              </Link>
              <Link 
                to="/login" 
                className="btn-lg bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary-700"
              >
                Se connecter
              </Link>
            </div>
          ) : (
            <Link 
              to="/events/create" 
              className="btn-lg bg-white text-primary-700 hover:bg-gray-100 inline-flex items-center"
            >
              Créer un événement
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
