// This file exports TypeScript types and interfaces used throughout the application.

export interface User {
    id: string;
    email: string;
    name?: string;
    createdAt: string;
}

export interface Trip {
    id: string;
    userId: string;
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budget: number;
    interests: string[];
}

export interface Hotel {
    id: string;
    name: string;
    address: string;
    rating: number;
    price: number;
    amenities: string[];
}

export interface Weather {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
}

export interface MapLocation {
    latitude: number;
    longitude: number;
    name: string;
}

export interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
}