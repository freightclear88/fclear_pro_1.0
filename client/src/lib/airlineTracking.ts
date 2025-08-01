// Air carrier/airline tracking utilities for client-side
// Based on IATA airline codes and AWB number formats from major airlines

export interface AirlineInfo {
  name: string;
  iataCode: string;
  prefix: string;
  trackingUrl: string;
  awbPattern: RegExp;
}

export const AIRLINES: AirlineInfo[] = [
  {
    name: "Delta Air Lines",
    iataCode: "DL",
    prefix: "006",
    trackingUrl: "https://www.delta.com/us/en/cargo/tracking",
    awbPattern: /^006[-\s]?\d{8}$/
  },
  {
    name: "American Airlines",
    iataCode: "AA",
    prefix: "001",
    trackingUrl: "https://www.aa.com/i18n/cargo/tracking.jsp",
    awbPattern: /^001[-\s]?\d{8}$/
  },
  {
    name: "United Airlines",
    iataCode: "UA", 
    prefix: "016",
    trackingUrl: "https://www.united.com/ual/en/us/fly/travel/cargo/tracking.html",
    awbPattern: /^016[-\s]?\d{8}$/
  },
  {
    name: "FedEx",
    iataCode: "FX",
    prefix: "023",
    trackingUrl: "https://www.fedex.com/fedextrack/",
    awbPattern: /^023[-\s]?\d{8}$/
  },
  {
    name: "UPS Airlines",
    iataCode: "5X",
    prefix: "406",
    trackingUrl: "https://www.ups.com/track",
    awbPattern: /^406[-\s]?\d{8}$/
  },
  {
    name: "DHL Aviation",
    iataCode: "D0",
    prefix: "057",
    trackingUrl: "https://www.dhl.com/us-en/home/tracking.html",
    awbPattern: /^057[-\s]?\d{8}$/
  },
  {
    name: "Lufthansa Cargo",
    iataCode: "LH",
    prefix: "020",
    trackingUrl: "https://www.lufthansa-cargo.com/US-en/Homepage/Tracking.jsp",
    awbPattern: /^020[-\s]?\d{8}$/
  },
  {
    name: "Emirates SkyCargo",
    iataCode: "EK",
    prefix: "176",
    trackingUrl: "https://www.emirates.com/us/english/cargo/track/",
    awbPattern: /^176[-\s]?\d{8}$/
  },
  {
    name: "British Airways",
    iataCode: "BA",
    prefix: "125",
    trackingUrl: "https://www.britishairways.com/en-us/information/cargo/track",
    awbPattern: /^125[-\s]?\d{8}$/
  },
  {
    name: "Cathay Pacific Cargo",
    iataCode: "CX",
    prefix: "160",
    trackingUrl: "https://www.cathaypacificcargo.com/tracking",
    awbPattern: /^160[-\s]?\d{8}$/
  },
  {
    name: "Korean Air Cargo",
    iataCode: "KE",
    prefix: "180",
    trackingUrl: "https://cargo.koreanair.com/tracking/",
    awbPattern: /^180[-\s]?\d{8}$/
  },
  {
    name: "China Airlines",
    iataCode: "CI",
    prefix: "297",
    trackingUrl: "https://www.china-airlines.com/us/en/cargo/tracking",
    awbPattern: /^297[-\s]?\d{8}$/
  },
  {
    name: "Singapore Airlines Cargo",
    iataCode: "SQ",
    prefix: "618",
    trackingUrl: "https://www.siacargo.com/track-trace",
    awbPattern: /^618[-\s]?\d{8}$/
  },
  {
    name: "Japan Airlines (JAL)",
    iataCode: "JL",
    prefix: "131",
    trackingUrl: "https://www.jal.com/en/cargo/tracking/",
    awbPattern: /^131[-\s]?\d{8}$/
  },
  {
    name: "All Nippon Airways (ANA)",
    iataCode: "NH",
    prefix: "205",
    trackingUrl: "https://www.anacargo.jp/tracking/",
    awbPattern: /^205[-\s]?\d{8}$/
  }
];

/**
 * Detects the airline from an AWB number
 */
export function detectAirlineFromAWB(awbNumber: string): AirlineInfo | null {
  if (!awbNumber || typeof awbNumber !== 'string') {
    return null;
  }

  const cleanAWB = awbNumber.trim().replace(/[-\s]/g, '');
  
  // Extract the airline prefix (first 3 digits)
  const prefix = cleanAWB.substring(0, 3);
  
  // Find matching airline by prefix
  for (const airline of AIRLINES) {
    if (airline.prefix === prefix) {
      return airline;
    }
  }

  return null;
}

/**
 * Generates a direct tracking URL for an AWB number
 */
export function generateAWBTrackingUrl(awbNumber: string): string | null {
  const airline = detectAirlineFromAWB(awbNumber);
  if (!airline) {
    return null;
  }

  const cleanAWB = awbNumber.trim().replace(/[-\s]/g, '');

  // Generate airline-specific tracking URLs
  switch (airline.prefix) {
    case '006': // Delta
      return `https://www.delta.com/us/en/cargo/tracking?awbNumber=${cleanAWB}`;
    case '001': // American Airlines
      return `https://www.aa.com/i18n/cargo/tracking.jsp?awbNumber=${cleanAWB}`;
    case '016': // United
      return `https://www.united.com/ual/en/us/fly/travel/cargo/tracking.html?awbNumber=${cleanAWB}`;
    case '023': // FedEx
      return `https://www.fedex.com/fedextrack/?trknbr=${cleanAWB}`;
    case '406': // UPS
      return `https://www.ups.com/track?loc=en_US&tracknum=${cleanAWB}`;
    case '057': // DHL
      return `https://www.dhl.com/us-en/home/tracking.html?submit=1&tracking-id=${cleanAWB}`;
    case '020': // Lufthansa
      return `https://www.lufthansa-cargo.com/US-en/Homepage/Tracking.jsp?awbNumber=${cleanAWB}`;
    case '176': // Emirates
      return `https://www.emirates.com/us/english/cargo/track/?awbNumber=${cleanAWB}`;
    case '125': // British Airways
      return `https://www.britishairways.com/en-us/information/cargo/track?awbNumber=${cleanAWB}`;
    case '160': // Cathay Pacific
      return `https://www.cathaypacificcargo.com/tracking?awbNumber=${cleanAWB}`;
    case '180': // Korean Air
      return `https://cargo.koreanair.com/tracking/?awbNumber=${cleanAWB}`;
    case '297': // China Airlines
      return `https://www.china-airlines.com/us/en/cargo/tracking?awbNumber=${cleanAWB}`;
    case '618': // Singapore Airlines
      return `https://www.siacargo.com/track-trace?awbNumber=${cleanAWB}`;
    case '131': // JAL
      return `https://www.jal.com/en/cargo/tracking/?awbNumber=${cleanAWB}`;
    case '205': // ANA
      return `https://www.anacargo.jp/tracking/?awbNumber=${cleanAWB}`;
    default:
      // Return general airline tracking page as fallback
      return airline.trackingUrl;
  }
}

/**
 * Validates if a string is a valid AWB format
 */
export function isValidAWBFormat(awbNumber: string): boolean {
  if (!awbNumber || typeof awbNumber !== 'string') {
    return false;
  }

  const cleanAWB = awbNumber.trim().replace(/[-\s]/g, '');
  
  // Standard AWB format: 3-digit airline prefix + 8-digit serial number
  const awbPattern = /^\d{11}$/;
  
  return awbPattern.test(cleanAWB) && detectAirlineFromAWB(cleanAWB) !== null;
}

/**
 * Formats an AWB number for display
 */
export function formatAWBNumber(awbNumber: string): string {
  if (!awbNumber) return '';
  
  const cleanAWB = awbNumber.trim().replace(/[-\s]/g, '');
  
  // Format as XXX-XXXXXXXX if it's 11 digits
  if (cleanAWB.length === 11 && /^\d{11}$/.test(cleanAWB)) {
    return `${cleanAWB.substring(0, 3)}-${cleanAWB.substring(3)}`;
  }
  
  return awbNumber.trim().toUpperCase();
}