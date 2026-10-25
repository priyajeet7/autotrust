export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const CATEGORIES = [
  'SEDAN',
  'SUV',
  'TRUCK',
  'COUPE',
  'HATCHBACK',
  'CONVERTIBLE',
  'VAN',
  'WAGON',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  category: Category;
  price: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleInput {
  make: string;
  model: string;
  year: number;
  category: Category;
  price: number;
  quantity: number;
}

/** Search form values; empty strings mean "no filter". */
export interface SearchFilters {
  make: string;
  model: string;
  category: Category | '';
  minPrice: string;
  maxPrice: string;
}

export interface Session {
  token: string;
  user: User;
}

export function categoryLabel(category: Category): string {
  return category === 'SUV' ? 'SUV' : category.charAt(0) + category.slice(1).toLowerCase();
}
