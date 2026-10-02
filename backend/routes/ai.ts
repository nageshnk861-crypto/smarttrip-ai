import { Router } from 'express';
import { chatAI, planDeterministic, planTrip } from '../controllers/aiController.js';

const router = Router();

router.post('/chat', chatAI);
router.post('/plan-trip', planTrip);
router.post('/plan', planDeterministic);
router.post('/', chatAI);

export default router;
