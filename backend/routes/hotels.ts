import { Router } from 'express';
import { getHotels } from '../controllers/hotelsController.js';

const router = Router();

router.get('/search', getHotels);
router.get('/', getHotels);

export default router;
