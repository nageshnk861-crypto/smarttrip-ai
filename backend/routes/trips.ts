import { Router } from 'express';
import { createTrip, deleteTrip, getTripById, getTrips } from '../controllers/tripsController.js';

const router = Router();

router.get('/', getTrips);
router.get('/:id', getTripById);
router.post('/', createTrip);
router.delete('/:id', deleteTrip);

export default router;
