/**
 * lib/transport/bus-rate-model.ts
 *
 * ALL-INDIA BUS FARE PLANNING & BUDGET ENGINE
 *
 * Deterministic, free, transparent bus transportation calculation.
 * Works across all Indian states and Union Territories.
 *
 * Zero paid APIs, zero fake live data, zero AI hallucinations.
 *
 * Statuses:
 *   - VERIFIED: Actual confirmed current operator fare
 *   - DATASET: Sourced from official open dataset / GTFS
 *   - ESTIMATED: Calculated via road distance × bus category planning rate
 *   - UNAVAILABLE: Distance missing or route unresolvable
 *
 * Bus Planning Rates (₹/km per passenger):
 *   - ORDINARY:                 low = ₹1.00, expected = ₹1.75, high = ₹2.50
 *   - EXPRESS_DELUXE:           low = ₹1.50, expected = ₹2.50, high = ₹3.50
 *   - AC_PREMIUM:               low = ₹2.50, expected = ₹4.25, high = ₹6.00
 *   - PRIVATE_SEATER_SLEEPER:   low = ₹1.50, expected = ₹3.25, high = ₹5.00
 */

export type BusCategory =
  | 'ORDINARY'
  | 'EXPRESS_DELUXE'
  | 'AC_PREMIUM'
  | 'PRIVATE_SEATER_SLEEPER'
  // Legacy aliases for full backward compatibility
  | 'EXPRESS'
  | 'DELUXE'
  | 'AC'
  | 'VOLVO'
  | 'PREMIUM'
  | 'PRIVATE_SEATER'
  | 'PRIVATE_SLEEPER';

export type FareStatus = 'VERIFIED' | 'DATASET' | 'ESTIMATED' | 'UNAVAILABLE';
export type DistanceStatus = 'CALCULATED' | 'ESTIMATED_HAVERSINE' | 'UNAVAILABLE';
export type TripType = 'ONE_WAY' | 'ROUND_TRIP';
export type DatasetDataStatus = 'CURRENT' | 'DATASET' | 'OUTDATED' | 'UNKNOWN';

export interface BusPlanningRate {
  low: number;
  expected: number;
  high: number;
}

export const BUS_PLANNING_RATES: Record<string, BusPlanningRate> = {
  ORDINARY: { low: 1.00, expected: 1.75, high: 2.50 },
  EXPRESS_DELUXE: { low: 1.50, expected: 2.50, high: 3.50 },
  AC_PREMIUM: { low: 2.50, expected: 4.25, high: 6.00 },
  PRIVATE_SEATER_SLEEPER: { low: 1.50, expected: 3.25, high: 5.00 },

  // Aliases mapping to the standard 4 tiers
  EXPRESS: { low: 1.50, expected: 2.50, high: 3.50 },
  DELUXE: { low: 1.50, expected: 2.50, high: 3.50 },
  AC: { low: 2.50, expected: 4.25, high: 6.00 },
  VOLVO: { low: 2.50, expected: 4.25, high: 6.00 },
  PREMIUM: { low: 2.50, expected: 4.25, high: 6.00 },
  PRIVATE_SEATER: { low: 1.50, expected: 3.25, high: 5.00 },
  PRIVATE_SLEEPER: { low: 1.50, expected: 3.25, high: 5.00 },
};

export interface FareRange {
  low: number;
  expected: number;
  high: number;
}

export interface EstimateBusFareParams {
  origin?: string;
  destination?: string;
  distanceKm?: number | null;
  busCategory?: BusCategory | string;
  category?: BusCategory | string;
  travelers?: number;
  tripType?: TripType | string;
  roundTrip?: boolean;
  actualFare?: number | null;
  fareStatus?: FareStatus;
  source?: string;
  sourceUrl?: string | null;
  distanceSource?: string;
  distanceStatus?: DistanceStatus;
}

export interface BusFareEstimate {
  // Top-level fares
  oneWayLow: number | null;
  oneWayExpected: number | null;
  oneWayHigh: number | null;
  totalLow: number | null;
  totalExpected: number | null;
  totalHigh: number | null;

  // Grouped objects
  oneWay: FareRange | null;
  total: FareRange | null;
  fare: {
    low: number | null;
    expected: number | null;
    high: number | null;
    currency: 'INR';
  };

  origin?: string;
  destination?: string;
  distanceKm: number | null;
  distanceSource: string;
  distanceStatus: DistanceStatus;
  travelers: number;
  tripType: TripType;
  roundTrip: boolean;
  busCategory: BusCategory;
  category: BusCategory;
  ratePerKm: BusPlanningRate;
  currency: 'INR';
  status: FareStatus;
  fareStatus: FareStatus;
  method: string;
  source: {
    name: string;
    url?: string | null;
  };
  fareSource: string;
  sourceUrl: string | null;
  retrievedAt: string;
  verifiedFarePerPerson?: number | null;
}

/**
 * Normalizes input category string to a canonical BusCategory.
 */
export function normalizeBusCategory(category?: string): BusCategory {
  if (!category) return 'EXPRESS_DELUXE';
  const clean = category.toUpperCase().trim().replace(/[\s\-_/]+/g, '_');

  if (
    clean === 'ORDINARY' ||
    clean === 'LOCAL' ||
    clean.includes('CITY') ||
    clean.includes('NON_AC_SEATER')
  ) {
    return 'ORDINARY';
  }

  if (
    clean === 'AC_PREMIUM' ||
    clean.includes('VOLVO') ||
    clean.includes('PREMIUM') ||
    clean.includes('SCANIA') ||
    clean.includes('MERCEDES') ||
    clean.includes('CLUB_CLASS') ||
    clean.includes('AIRAVAT') ||
    clean.includes('RAJHANS') ||
    clean.includes('SHIVSHAHI') ||
    clean.includes('GARUDA') ||
    clean === 'AC'
  ) {
    return 'AC_PREMIUM';
  }

  if (
    clean === 'PRIVATE_SEATER_SLEEPER' ||
    clean.includes('SLEEPER') ||
    clean.includes('PRIVATE')
  ) {
    return 'PRIVATE_SEATER_SLEEPER';
  }

  return 'EXPRESS_DELUXE';
}

/**
 * Calculates deterministic bus fare estimate according to the SmartTrip planning rate model.
 *
 * Priority Rules:
 *   1. Actual verified fare (status = VERIFIED)
 *   2. Reliable government/public dataset fare (status = DATASET)
 *   3. Distance-based planning estimate (status = ESTIMATED)
 *   4. Unavailable (distance is missing or 0, status = UNAVAILABLE)
 */
export function estimateBusFare(params: EstimateBusFareParams): BusFareEstimate {
  // Input validations
  if (params.travelers !== undefined && (isNaN(params.travelers) || params.travelers < 1)) {
    throw new Error('Travelers count must be at least 1');
  }

  if (params.distanceKm !== undefined && params.distanceKm !== null && params.distanceKm < 0) {
    throw new Error('Distance cannot be negative');
  }

  const travelers = Math.max(1, Number(params.travelers) || 1);
  const isRoundTrip =
    params.tripType === 'ROUND_TRIP' ||
    params.roundTrip === true ||
    (params.tripType === undefined && params.roundTrip !== false);

  const tripType: TripType = isRoundTrip ? 'ROUND_TRIP' : 'ONE_WAY';
  const rawCat = params.busCategory || params.category;
  const busCategory = normalizeBusCategory(rawCat);
  const ratePerKm = BUS_PLANNING_RATES[busCategory] || BUS_PLANNING_RATES.EXPRESS_DELUXE;
  const retrievedAt = new Date().toISOString();
  const journeyMultiplier = isRoundTrip ? 2 : 1;
  const origin = params.origin || 'Origin';
  const destination = params.destination || 'Destination';
  const distanceSource = params.distanceSource || (params.distanceKm ? 'OpenRouteService' : 'None');

  // PRIORITY 1 & 2: Actual Verified / Dataset Fare
  if (
    params.actualFare !== undefined &&
    params.actualFare !== null &&
    !isNaN(params.actualFare) &&
    params.actualFare > 0
  ) {
    const verifiedStatus: FareStatus = params.fareStatus === 'DATASET' ? 'DATASET' : 'VERIFIED';
    const singleOneWay = Math.round(params.actualFare * travelers);
    const totalAmount = singleOneWay * journeyMultiplier;
    const sourceName = params.source || 'Verified Operator Fare';

    return {
      oneWayLow: singleOneWay,
      oneWayExpected: singleOneWay,
      oneWayHigh: singleOneWay,
      totalLow: totalAmount,
      totalExpected: totalAmount,
      totalHigh: totalAmount,
      oneWay: { low: singleOneWay, expected: singleOneWay, high: singleOneWay },
      total: { low: totalAmount, expected: totalAmount, high: totalAmount },
      fare: { low: totalAmount, expected: totalAmount, high: totalAmount, currency: 'INR' },
      origin,
      destination,
      distanceKm: params.distanceKm && params.distanceKm > 0 ? params.distanceKm : null,
      distanceSource,
      distanceStatus: params.distanceKm && params.distanceKm > 0 ? 'CALCULATED' : 'UNAVAILABLE',
      travelers,
      tripType,
      roundTrip: isRoundTrip,
      busCategory,
      category: busCategory,
      ratePerKm,
      currency: 'INR',
      status: verifiedStatus,
      fareStatus: verifiedStatus,
      method: `ACTUAL_OPERATOR_FARE (${sourceName})`,
      source: { name: sourceName, url: params.sourceUrl ?? null },
      fareSource: sourceName,
      sourceUrl: params.sourceUrl ?? null,
      retrievedAt,
      verifiedFarePerPerson: params.actualFare,
    };
  }

  // PRIORITY 4: Distance Missing / Zero -> UNAVAILABLE
  if (
    params.distanceKm === undefined ||
    params.distanceKm === null ||
    isNaN(params.distanceKm) ||
    params.distanceKm <= 0
  ) {
    return {
      oneWayLow: null,
      oneWayExpected: null,
      oneWayHigh: null,
      totalLow: null,
      totalExpected: null,
      totalHigh: null,
      oneWay: null,
      total: null,
      fare: { low: null, expected: null, high: null, currency: 'INR' },
      origin,
      destination,
      distanceKm: null,
      distanceSource: 'None',
      distanceStatus: 'UNAVAILABLE',
      travelers,
      tripType,
      roundTrip: isRoundTrip,
      busCategory,
      category: busCategory,
      ratePerKm,
      currency: 'INR',
      status: 'UNAVAILABLE',
      fareStatus: 'UNAVAILABLE',
      method: 'UNAVAILABLE',
      source: { name: 'SmartTrip planning engine', url: null },
      fareSource: 'SmartTrip planning-rate model',
      sourceUrl: null,
      retrievedAt,
    };
  }

  // PRIORITY 3: Distance-Based Planning Estimate
  const distanceKm = params.distanceKm;
  const oneWayLow = Math.round(distanceKm * ratePerKm.low * travelers);
  const oneWayExpected = Math.round(distanceKm * ratePerKm.expected * travelers);
  const oneWayHigh = Math.round(distanceKm * ratePerKm.high * travelers);

  const totalLow = oneWayLow * journeyMultiplier;
  const totalExpected = oneWayExpected * journeyMultiplier;
  const totalHigh = oneWayHigh * journeyMultiplier;

  return {
    oneWayLow,
    oneWayExpected,
    oneWayHigh,
    totalLow,
    totalExpected,
    totalHigh,
    oneWay: { low: oneWayLow, expected: oneWayExpected, high: oneWayHigh },
    total: { low: totalLow, expected: totalExpected, high: totalHigh },
    fare: { low: totalLow, expected: totalExpected, high: totalHigh, currency: 'INR' },
    origin,
    destination,
    distanceKm,
    distanceSource,
    distanceStatus: (params.distanceStatus as DistanceStatus) || 'CALCULATED',
    travelers,
    tripType,
    roundTrip: isRoundTrip,
    busCategory,
    category: busCategory,
    ratePerKm,
    currency: 'INR',
    status: 'ESTIMATED',
    fareStatus: 'ESTIMATED',
    method: 'DISTANCE_X_PLANNING_RATE',
    source: { name: 'SmartTrip planning engine' },
    fareSource: 'SmartTrip planning-rate model',
    sourceUrl: null,
    retrievedAt,
  };
}

/**
 * All-India Bus Transport Operator Directory.
 * Represents State Road Transport Corporations (SRTCs), metropolitan transit, and private operators across all states & UTs.
 */
export interface BusOperatorInfo {
  operatorName: string;
  operatorCode: string;
  state: string;
  serviceArea: string;
  officialUrl: string;
  busCategories: BusCategory[];
  isStateRun: boolean;
}

export const ALL_INDIA_OPERATORS: BusOperatorInfo[] = [
  // Karnataka
  {
    operatorName: 'Karnataka State Road Transport Corporation',
    operatorCode: 'KSRTC',
    state: 'Karnataka',
    serviceArea: 'South & Central Karnataka, Inter-state routes',
    officialUrl: 'https://www.ksrtc.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Bengaluru Metropolitan Transport Corporation',
    operatorCode: 'BMTC',
    state: 'Karnataka',
    serviceArea: 'Bengaluru Urban & Metropolitan Area',
    officialUrl: 'https://mybmtc.karnataka.gov.in/',
    busCategories: ['ORDINARY', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'North Western Karnataka Road Transport Corporation',
    operatorCode: 'NWKRTC',
    state: 'Karnataka',
    serviceArea: 'Hubballi, Belagavi, Bagalkote, Dharwad, Uttara Kannada',
    officialUrl: 'https://nwkrtc.karnataka.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Kalyana Karnataka Road Transport Corporation',
    operatorCode: 'KKRTC',
    state: 'Karnataka',
    serviceArea: 'Kalaburagi, Ballari, Raichur, Koppal, Yadgir, Bidar',
    officialUrl: 'https://kkrtc.karnataka.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // Maharashtra
  {
    operatorName: 'Maharashtra State Road Transport Corporation',
    operatorCode: 'MSRTC',
    state: 'Maharashtra',
    serviceArea: 'Statewide Maharashtra & Inter-state',
    officialUrl: 'https://msrtc.maharashtra.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // Tamil Nadu
  {
    operatorName: 'Tamil Nadu State Transport Corporation',
    operatorCode: 'TNSTC',
    state: 'Tamil Nadu',
    serviceArea: 'Tamil Nadu regional divisions',
    officialUrl: 'https://www.tnstc.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE'],
    isStateRun: true,
  },
  {
    operatorName: 'State Express Transport Corporation',
    operatorCode: 'SETC',
    state: 'Tamil Nadu',
    serviceArea: 'Long-distance intercity & inter-state',
    officialUrl: 'https://www.tnstc.in/',
    busCategories: ['EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // Andhra Pradesh & Telangana
  {
    operatorName: 'Andhra Pradesh State Road Transport Corporation',
    operatorCode: 'APSRTC',
    state: 'Andhra Pradesh',
    serviceArea: 'Andhra Pradesh & Inter-state',
    officialUrl: 'https://www.apsrtconline.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Telangana State Road Transport Corporation',
    operatorCode: 'TGSRTC',
    state: 'Telangana',
    serviceArea: 'Hyderabad & Telangana intercity',
    officialUrl: 'https://www.tgsrtcbus.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // Kerala
  {
    operatorName: 'Kerala State Road Transport Corporation',
    operatorCode: 'KSRTC_KERALA',
    state: 'Kerala',
    serviceArea: 'Kerala & KSRTC-SWIFT long distance',
    officialUrl: 'https://www.keralartc.com/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // Gujarat & Rajasthan
  {
    operatorName: 'Gujarat State Road Transport Corporation',
    operatorCode: 'GSRTC',
    state: 'Gujarat',
    serviceArea: 'Gujarat & Inter-state',
    officialUrl: 'https://gsrtc.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Rajasthan State Road Transport Corporation',
    operatorCode: 'RSRTC',
    state: 'Rajasthan',
    serviceArea: 'Rajasthan & North India',
    officialUrl: 'https://transport.rajasthan.gov.in/rsrtc/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },

  // North & East India
  {
    operatorName: 'Uttar Pradesh State Road Transport Corporation',
    operatorCode: 'UPSRTC',
    state: 'Uttar Pradesh',
    serviceArea: 'Uttar Pradesh & NCR',
    officialUrl: 'https://www.upsrtc.up.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'West Bengal Transport Corporation',
    operatorCode: 'WBTC',
    state: 'West Bengal',
    serviceArea: 'Kolkata Metropolitan & West Bengal',
    officialUrl: 'https://wbtc.co.in/',
    busCategories: ['ORDINARY', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Odisha State Road Transport Corporation',
    operatorCode: 'OSRTC',
    state: 'Odisha',
    serviceArea: 'Odisha statewide',
    officialUrl: 'https://osrtc.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Punjab Roadways / PUNBUS',
    operatorCode: 'PUNBUS',
    state: 'Punjab',
    serviceArea: 'Punjab & North India',
    officialUrl: 'https://punbusonline.com/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Haryana Roadways',
    operatorCode: 'HARYANA_ROADWAYS',
    state: 'Haryana',
    serviceArea: 'Haryana & NCR',
    officialUrl: 'https://hartrans.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Himachal Road Transport Corporation',
    operatorCode: 'HRTC',
    state: 'Himachal Pradesh',
    serviceArea: 'Himachal Pradesh & Hill Routes',
    officialUrl: 'https://www.hrtchp.com/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Uttarakhand Transport Corporation',
    operatorCode: 'UTC',
    state: 'Uttarakhand',
    serviceArea: 'Uttarakhand statewide',
    officialUrl: 'https://utc.uk.gov.in/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Delhi Transport Corporation',
    operatorCode: 'DTC',
    state: 'Delhi NCR',
    serviceArea: 'National Capital Region',
    officialUrl: 'https://dtc.delhi.gov.in/',
    busCategories: ['ORDINARY', 'AC_PREMIUM'],
    isStateRun: true,
  },
  {
    operatorName: 'Kadamba Transport Corporation',
    operatorCode: 'KTC',
    state: 'Goa',
    serviceArea: 'Goa & Western Ghats',
    officialUrl: 'https://ktclgoa.com/',
    busCategories: ['ORDINARY', 'EXPRESS_DELUXE', 'AC_PREMIUM'],
    isStateRun: true,
  },
];

/**
 * GTFS Data Types and Dataset Structure Support.
 */
export interface GTFSFeed {
  feedId: string;
  operatorName: string;
  sourceUrl: string;
  retrievedAt: string;
  lastUpdatedAt?: string | null;
  dataStatus: DatasetDataStatus;
  routes: Array<{ routeId: string; routeShortName: string; routeLongName: string; routeType: number }>;
  stops: Array<{ stopId: string; stopName: string; stopLat: number; stopLon: number }>;
  fares?: Array<{ fareId: string; price: number; currencyType: string; originId?: string; destinationId?: string }>;
}

/**
 * Bus Route Matching Helper.
 * Matches origin & destination against known GTFS or dataset feeds.
 * If no route is found, cleanly indicates unavailable without hallucinating.
 */
export function matchBusRoute(
  origin: string,
  destination: string,
  feeds: GTFSFeed[] = []
): { matched: boolean; routeDescription: string; message: string; fare: number | null } {
  const normOrigin = origin.toLowerCase().trim();
  const normDest = destination.toLowerCase().trim();

  for (const feed of feeds) {
    if (feed.fares) {
      const match = feed.fares.find(
        (f) =>
          f.originId?.toLowerCase().includes(normOrigin) &&
          f.destinationId?.toLowerCase().includes(normDest)
      );
      if (match) {
        return {
          matched: true,
          routeDescription: `Direct route via ${feed.operatorName}`,
          message: `Found route in ${feed.operatorName} open dataset`,
          fare: match.price,
        };
      }
    }
  }

  return {
    matched: false,
    routeDescription: 'Route details unavailable from open datasets',
    message: 'Bus route information unavailable from free open datasets. Using road distance planning estimate.',
    fare: null,
  };
}
