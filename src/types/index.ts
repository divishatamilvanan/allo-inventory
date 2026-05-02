// src/types/index.ts
export interface ProductWithStock {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stocks: {
    warehouseId: string;
    warehouseName: string;
    warehouseLocation: string;
    total: number;
    reserved: number;
    available: number;
  }[];
}

export interface ReservationWithDetails {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export interface ApiError {
  error: string;
  code?: string;
}
