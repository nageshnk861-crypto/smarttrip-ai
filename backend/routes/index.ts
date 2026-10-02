import { Request, Response, Router } from 'express';
import aiRouter from './ai.js';
import attractionsRouter from './attractions.js';
import hotelsRouter from './hotels.js';
import transportRouter from './transport.js';
import tripsRouter from './trips.js';
import weatherRouter from './weather.js';
import { planDeterministic, planTrip } from '../controllers/aiController.js';
import {
  autocompletePlaces,
  getDestinations,
  getIpLocation,
  reverseGeocodePlace,
  searchPlaces,
} from '../controllers/attractionsController.js';


const apiRouter = Router();

// Modular Resource Routes
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/attractions', attractionsRouter);
apiRouter.use('/hotels', hotelsRouter);
apiRouter.use('/transport', transportRouter);
apiRouter.use('/weather', weatherRouter);
apiRouter.use('/ai', aiRouter);

// Aliases / Compatibility routes for existing frontend client calls
apiRouter.get('/destinations', getDestinations);
apiRouter.get('/places/search', searchPlaces);
apiRouter.get('/places/autocomplete', autocompletePlaces);
apiRouter.get('/places/nearby', searchPlaces);
apiRouter.get('/places/reverse-geocode', reverseGeocodePlace);
apiRouter.get('/places/ip-location', getIpLocation);
apiRouter.post('/plan', planDeterministic);
apiRouter.post('/plan-trip', planTrip);

// Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'SmartTrip API Backend' });
});

export default apiRouter;
