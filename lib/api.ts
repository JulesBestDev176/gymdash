import axios, { AxiosResponse } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.gympass.minifootapp.com';
const GYMDASH_SECRET = process.env.GYMDASH_SECRET || 'gymdash_secret_2024';

// Unwrap { success: true, data: X } → X automatically
function unwrap(res: AxiosResponse) {
  if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
    res.data = res.data.data;
  }
  return res;
}

export const api = axios.create({ baseURL: API_URL });

// Intercepteur : ajoute JWT si dispo
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gymdash_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
api.interceptors.response.use(unwrap);

// Client super-admin (x-gymdash-secret + JWT)
export const adminApi = axios.create({
  baseURL: API_URL,
  headers: { 'x-gymdash-secret': GYMDASH_SECRET },
});
adminApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gymdash_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
adminApi.interceptors.response.use(unwrap);

// Types
export type GymStatut = 'ACTIF' | 'INACTIF' | 'SUSPENDU';

export interface Gym {
  id: string;
  nom: string;
  slug: string;
  ville: string;
  pays: string;
  fraisInscription: number;
  prixMensualite: number;
  prixSeance: number;
  dureeMensualite: number;
  antiDoubleScanSec: number;
  statut: GymStatut;
  createdAt: string;
  nbAdherents?: number;
  nbUsers?: number;
  revenuMois?: number;
}

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'ADMIN' | 'GERANT';
  actif: boolean;
  gymId: string;
  createdAt: string;
}

export interface GlobalStats {
  nbGyms: number;
  nbAdherents: number;
  revenuMois: number;
  nbEntreesAujourdhui: number;
  revenueChart: { label: string; revenu: number }[];
  top5Gyms: { gymId: string; gymNom: string; revenuMois: number }[];
  revenuePerGym: { gymId: string; gymNom: string; monthly: { label: string; revenu: number }[]; revenuMois: number }[];
}

// Helpers
export const fmtFcfa = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
