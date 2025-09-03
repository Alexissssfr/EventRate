import React, { createContext, useContext, useReducer, useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";
import { authAPI } from "../services/api";
import toast from "react-hot-toast";

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: false,
  isLoading: true,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case "UPDATE_USER":
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const queryClient = useQueryClient();

  // Vérifier l'authentification au chargement
  const { data: userData, isLoading: userLoading } = useQuery(
    ["user", state.token],
    () => authAPI.getCurrentUser(),
    {
      enabled: !!state.token,
      retry: false,
      onError: () => {
        // Token invalide, déconnecter l'utilisateur
        logout();
      },
    }
  );

  useEffect(() => {
    if (userData && state.token) {
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: { user: userData, token: state.token },
      });
    } else if (!state.token) {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [userData, state.token]);

  useEffect(() => {
    if (!userLoading && state.token) {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [userLoading, state.token]);

  const login = async (credentials) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.login(credentials);

      localStorage.setItem("token", response.token);
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: response,
      });

      toast.success("Connexion réussie !");
      return response;
    } catch (error) {
      dispatch({ type: "SET_LOADING", payload: false });
      toast.error(error.response?.data?.error || "Erreur de connexion");
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.register(userData);

      localStorage.setItem("token", response.token);
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: response,
      });

      toast.success("Inscription réussie !");
      return response;
    } catch (error) {
      dispatch({ type: "SET_LOADING", payload: false });
      toast.error(error.response?.data?.error || "Erreur d'inscription");
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
    queryClient.clear();
    toast.success("Déconnexion réussie");
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      dispatch({
        type: "UPDATE_USER",
        payload: response.user,
      });
      toast.success("Profil mis à jour !");
      return response;
    } catch (error) {
      toast.error(error.response?.data?.error || "Erreur de mise à jour");
      throw error;
    }
  };

  const becomeCreator = async () => {
    try {
      const response = await authAPI.becomeCreator();
      dispatch({
        type: "UPDATE_USER",
        payload: response.user,
      });
      toast.success("Vous êtes maintenant créateur d'événements !");
      return response;
    } catch (error) {
      toast.error(error.response?.data?.error || "Erreur lors de la promotion");
      throw error;
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    becomeCreator,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
