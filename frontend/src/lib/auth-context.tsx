"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, agencyApi } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_client?: boolean;
}

export interface AgencyMembership {
  agency_id: string;
  role: string;
  agency_name: string;
}

export interface LoginResult {
  user: User;
  role: string;
  isSpecialist: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeAgencyId: string | null;
  agencies: AgencyMembership[];
  currentRole: string;
  isOwnerOrManager: boolean;
  isSpecialist: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<LoginResult | null>;
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
  currentRole: "owner",
  isOwnerOrManager: true,
  isSpecialist: false,
  isLoading: true,
  login: async () => null,
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

  const fetchAgencies = async (authToken: string): Promise<AgencyMembership[]> => {
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
      return mapped;
    } catch (e) {
      console.error("Failed to fetch agencies", e);
      return [];
    }
  };

  const login = async (newToken: string): Promise<LoginResult | null> => {
    localStorage.setItem("agencyos_token", newToken);
    setToken(newToken);
    try {
      const userData = (await authApi.me(newToken)) as User;
      setUser(userData);
      const userAgencies = await fetchAgencies(newToken);
      const stored = localStorage.getItem("agencyos_active_agency");
      const activeAgency = userAgencies.find((a) => a.agency_id === stored) || userAgencies[0];
      if (activeAgency) {
        setActiveAgencyId(activeAgency.agency_id);
        localStorage.setItem("agencyos_active_agency", activeAgency.agency_id);
      }
      const role = (activeAgency?.role || "owner").toLowerCase();
      const isSpec = ["writer", "editor", "designer"].includes(role);
      return { user: userData, role, isSpecialist: isSpec };
    } catch (e) {
      console.error("Login verification failed", e);
      logout();
      return null;
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

  const effectiveAgencyId = activeAgencyId || (agencies.length > 0 ? agencies[0].agency_id : null);
  const currentAgency = agencies.find((a) => a.agency_id === (activeAgencyId || effectiveAgencyId));
  const currentRole = (currentAgency?.role || "owner").toLowerCase();
  const isOwnerOrManager = ["owner", "manager", "account_manager"].includes(currentRole);
  const isSpecialist = ["writer", "editor", "designer"].includes(currentRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeAgencyId,
        agencies,
        currentRole,
        isOwnerOrManager,
        isSpecialist,
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
