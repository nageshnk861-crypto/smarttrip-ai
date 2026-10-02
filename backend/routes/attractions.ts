import { Router } from 'express';
import {
  getCategories,
  searchPlacesByCategory,
  getDestinations,
  autocompletePlaces,
  searchPlaces,
} from '../controllers/attractionsController.js';

const router = Router();

// GET /api/attractions/categories
router.get('/categories', getCategories);

// GET /api/attractions/search?category=temple&latitude=12.97&longitude=77.59&radius=5000
router.get('/search', searchPlacesByCategory);

// GET /api/attractions/destinations
router.get('/destinations', getDestinations);

// GET /api/attractions/autocomplete?q=goa
router.get('/autocomplete', autocompletePlaces);

// Legacy fallback
router.get('/', searchPlaces);

export default router;
