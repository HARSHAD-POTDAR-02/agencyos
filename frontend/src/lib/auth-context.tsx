"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, agencyApi } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export interface AgencyMembership {
  agency_id: string;
  role: string;
  agency_name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeAgencyId: string | null;
  agencies: AgencyMembership[];
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  setActiveAgencyId: (id: string) => void;
  createAgency: (name: string) => Promise<string>;
  refreshAgencies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  activeAgencyId: null,
  agencies: [],
  isLoading: true,
  login: async () => {},
  logout: () => {},
  setActiveAgencyId: () => {},
  createAgency: async () => "",
  refreshAgencies: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [agencies, setAgencies] = useState<AgencyMembership[]>([]);
  const [activeAgencyId, setActiveAgencyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgencies = async (authToken: string) => {
    try {
      const data = (await agencyApi.listMine(authToken)) as any[];
      const mapped = (data || [])
        .map((item) => ({
          agency_id: item.id || item.agency_id || item.agency?.id,
          role: item.role || "owner",
          agency_name: item.name || item.agency_name || item.agency?.name || "My Agency",
        }))
        .filter((item) => Boolean(item.agency_id));

      setAgencies(mapped);
      if (mapped.length > 0) {
        const stored = localStorage.getItem("agencyos_active_agency");
        if (stored && mapped.some((m) => m.agency_id === stored)) {
          setActiveAgencyId(stored);
        } else {
          setActiveAgencyId(mapped[0].agency_id);
          localStorage.setItem("agencyos_active_agency", mapped[0].agency_id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch agencies", e);
    }
  };

  const login = async (newToken: string) => {
    localStorage.setItem("agencyos_token", newToken);
    setToken(newToken);
    try {
      const userData = (await authApi.me(newToken)) as User;
      setUser(userData);
      await fetchAgencies(newToken);
    } catch (e) {
      console.error("Login verification failed", e);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem("agencyos_token");
    localStorage.removeItem("agencyos_active_agency");
    setToken(null);
    setUser(null);
    setAgencies([]);
    setActiveAgencyId(null);
  };

  const handleSetActiveAgency = (id: string) => {
    setActiveAgencyId(id);
    localStorage.setItem("agencyos_active_agency", id);
  };

  const createAgency = async (name: string): Promise<string> => {
    if (!token) throw new Error("You must be logged in to create an agency.");
    const newAgency = (await agencyApi.create({ name }, token)) as any;
    await fetchAgencies(token);
    if (newAgency && newAgency.id) {
      setActiveAgencyId(newAgency.id);
      localStorage.setItem("agencyos_active_agency", newAgency.id);
      return newAgency.id;
    }
    return "";
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("agencyos_token");
    if (savedToken) {
      login(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeAgencyId,
        agencies,
        isLoading,
        login,
        logout,
        setActiveAgencyId: handleSetActiveAgency,
        createAgency,
        refreshAgencies: () => (token ? fetchAgencies(token) : Promise.resolve()),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
