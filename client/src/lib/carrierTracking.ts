// Ocean carrier tracking utilities
// Based on SCAC codes and BL number formats from major shipping lines

export interface CarrierInfo {
  name: string;
  scacCode: string;
  trackingUrl: string;
  blPattern: RegExp;
  containerPrefixes: string[];
}

export const OCEAN_CARRIERS: CarrierInfo[] = [
  {
    name: "Maersk Line",
    scacCode: "MAEU",
    trackingUrl: "https://www.maersk.com/tracking/",
    blPattern: /^MAEU\d{7,12}$/,
    containerPrefixes: ["MAEU", "MSKU", "MRKU", "MSNU"]
  },
  {
    name: "Mediterranean Shipping Company (MSC)",
    scacCode: "MSCU",
    trackingUrl: "https://www.msc.com/en/track-a-shipment",
    blPattern: /^(MSCU|MEDU|MSC)\d{7,12}$/,
    containerPrefixes: ["MSCU", "MEDU", "MSMU"]
  },
  {
    name: "CMA CGM",
    scacCode: "CMAU",
    trackingUrl: "https://www.cma-cgm.com/ebusiness/tracking",
    blPattern: /^(CMAU|CMDU|CMA)\d{7,12}$/,
    containerPrefixes: ["CMAU", "CMDU"]
  },
  {
    name: "COSCO Shipping Lines",
    scacCode: "COSU",
    trackingUrl: "https://elines.coscoshipping.com/ebusiness/cargotracking",
    blPattern: /^(COSU|COSCO|CSCL|LLL)\w{7,15}$/,
    containerPrefixes: ["COSU", "COCU", "CBHU", "CJLU"]
  },
  {
    name: "Orient Overseas Container Line (OOCL)",
    scacCode: "OOLU",
    trackingUrl: "https://www.oocl.com/eng/ourservices/eservices/cargotracking/pages/cargotracking.aspx",
    blPattern: /^(OOLU|OOCL)\d{7,12}$/,
    containerPrefixes: ["OOLU", "OOCU"]
  },
  {
    name: "Evergreen Marine",
    scacCode: "EGLV",
    trackingUrl: "https://www.evergreen-line.com/emodal/stTrace/stTrace.do",
    blPattern: /^(EGLV|EVGN|EMC)\d{7,12}$/,
    containerPrefixes: ["EGLV", "GESU", "EMCU"]
  },
  {
    name: "Ocean Network Express (ONE)",
    scacCode: "ONEY",
    trackingUrl: "https://ecomm.one-line.com/one-ecom/manage-shipment/track-trace",
    blPattern: /^(ONEY|ONE)\w{7,15}$/,
    containerPrefixes: ["ONEU", "NYKU", "TTNU"]
  },
  {
    name: "Yang Ming Marine Transport",
    scacCode: "YMLU",
    trackingUrl: "https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx",
    blPattern: /^(YMLU|YML|YM)\w{7,15}$/,
    containerPrefixes: ["YMLU", "YARU"]
  },
  {
    name: "Hapag-Lloyd",
    scacCode: "HLCU",
    trackingUrl: "https://www.hapag-lloyd.com/en/online-business/track/track-by-container.html",
    blPattern: /^(HLCU|HAPL|HL)\w{7,15}$/,
    containerPrefixes: ["HLCU", "HLBU", "HASU"]
  },
  {
    name: "HMM (Hyundai Merchant Marine)",
    scacCode: "HDMU",
    trackingUrl: "https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp",
    blPattern: /^(HDMU|HMM|HYUN)\w{7,15}$/,
    containerPrefixes: ["HDMU", "HMMU"]
  },
  {
    name: "PIL Pacific International Lines",
    scacCode: "PABV",
    trackingUrl: "https://www.pilship.com/en--/120.html",
    blPattern: /^(PABV|PIL)\w{7,15}$/,
    containerPrefixes: ["PONU", "PILU"]
  },
  {
    name: "ZIM Integrated Shipping",
    scacCode: "ZIMU",
    trackingUrl: "https://www.zim.com/tools/track-a-shipment",
    blPattern: /^(ZIMU|ZIM)\w{7,15}$/,
    containerPrefixes: ["ZIMU", "ZIMB"]
  }
];

/**
 * Detects the ocean carrier from a bill of lading number
 */
export function detectCarrierFromBL(blNumber: string): CarrierInfo | null {
  if (!blNumber || typeof blNumber !== 'string') {
    return null;
  }

  const cleanBL = blNumber.trim().toUpperCase().replace(/[-\s]/g, '');
  
  // First try exact pattern matching
  for (const carrier of OCEAN_CARRIERS) {
    if (carrier.blPattern.test(cleanBL)) {
      return carrier;
    }
  }

  // Fallback: try prefix matching for common patterns
  const prefixPatterns = [
    { prefix: 'COSU', carrier: 'COSU' },
    { prefix: 'COSCO', carrier: 'COSU' },
    { prefix: 'CSCL', carrier: 'COSU' },
    { prefix: 'LLL', carrier: 'COSU' },
    { prefix: 'MAEU', carrier: 'MAEU' },
    { prefix: 'MSKU', carrier: 'MAEU' },
    { prefix: 'MSCU', carrier: 'MSCU' },
    { prefix: 'MSC', carrier: 'MSCU' },
    { prefix: 'CMAU', carrier: 'CMAU' },
    { prefix: 'CMA', carrier: 'CMAU' },
    { prefix: 'EGLV', carrier: 'EGLV' },
    { prefix: 'EVGN', carrier: 'EGLV' },
    { prefix: 'OOLU', carrier: 'OOLU' },
    { prefix: 'OOCL', carrier: 'OOLU' },
    { prefix: 'ONEY', carrier: 'ONEY' },
    { prefix: 'ONE', carrier: 'ONEY' },
    { prefix: 'YMLU', carrier: 'YMLU' },
    { prefix: 'YML', carrier: 'YMLU' },
    { prefix: 'YM', carrier: 'YMLU' },
    { prefix: 'HLCU', carrier: 'HLCU' },
    { prefix: 'HAPL', carrier: 'HLCU' },
    { prefix: 'HL', carrier: 'HLCU' },
    { prefix: 'HDMU', carrier: 'HDMU' },
    { prefix: 'HMM', carrier: 'HDMU' },
    { prefix: 'ZIMU', carrier: 'ZIMU' },
    { prefix: 'ZIM', carrier: 'ZIMU' },
    { prefix: 'PABV', carrier: 'PABV' },
    { prefix: 'PIL', carrier: 'PABV' }
  ];

  for (const pattern of prefixPatterns) {
    if (cleanBL.startsWith(pattern.prefix)) {
      return OCEAN_CARRIERS.find(c => c.scacCode === pattern.carrier) || null;
    }
  }

  return null;
}

/**
 * Detects the ocean carrier from a container number
 */
export function detectCarrierFromContainer(containerNumber: string): CarrierInfo | null {
  if (!containerNumber || typeof containerNumber !== 'string') {
    return null;
  }

  const cleanContainer = containerNumber.trim().toUpperCase();
  const prefix = cleanContainer.substring(0, 4);
  
  // First try exact prefix matching
  for (const carrier of OCEAN_CARRIERS) {
    if (carrier.containerPrefixes.includes(prefix)) {
      return carrier;
    }
  }

  // Extended container prefix patterns for common carriers
  const extendedPrefixes = [
    // Maersk variations
    { prefixes: ['MSKU', 'MRKU', 'MSNU', 'MAEU'], carrier: 'MAEU' },
    // MSC variations  
    { prefixes: ['MSCU', 'MEDU', 'MSMU'], carrier: 'MSCU' },
    // CMA CGM variations
    { prefixes: ['CMAU', 'CMDU'], carrier: 'CMAU' },
    // COSCO variations
    { prefixes: ['COSU', 'COCU', 'CBHU', 'CJLU'], carrier: 'COSU' },
    // OOCL variations
    { prefixes: ['OOLU', 'OOCU'], carrier: 'OOLU' },
    // Evergreen variations
    { prefixes: ['EGLV', 'GESU', 'EMCU'], carrier: 'EGLV' },
    // ONE variations
    { prefixes: ['ONEU', 'NYKU', 'TTNU'], carrier: 'ONEY' },
    // Yang Ming variations
    { prefixes: ['YMLU', 'YARU'], carrier: 'YMLU' },
    // Hapag-Lloyd variations
    { prefixes: ['HLCU', 'HLBU', 'HASU'], carrier: 'HLCU' },
    // HMM variations
    { prefixes: ['HDMU', 'HMMU'], carrier: 'HDMU' },
    // PIL variations
    { prefixes: ['PONU', 'PILU'], carrier: 'PABV' },
    // ZIM variations
    { prefixes: ['ZIMU', 'ZIMB'], carrier: 'ZIMU' },
    // Common leasing company prefixes that often indicate specific carriers
    { prefixes: ['TRHU', 'TRLU', 'TRIU', 'TGHU'], carrier: 'GENERIC_LEASING' }
  ];

  for (const pattern of extendedPrefixes) {
    if (pattern.prefixes.includes(prefix)) {
      if (pattern.carrier === 'GENERIC_LEASING') {
        // For leasing containers, we can't determine the specific carrier
        // but we can still provide a generic tracking option
        return null;
      }
      return OCEAN_CARRIERS.find(c => c.scacCode === pattern.carrier) || null;
    }
  }

  return null;
}

/**
 * Generates a direct tracking URL for a bill of lading number
 */
export function generateTrackingUrl(blNumber: string): string | null {
  const carrier = detectCarrierFromBL(blNumber);
  if (!carrier) {
    return null;
  }

  const cleanBL = blNumber.trim().replace(/[-\s]/g, '');

  // Generate carrier-specific tracking URLs
  switch (carrier.scacCode) {
    case 'MAEU':
      return `https://www.maersk.com/tracking/${cleanBL}`;
    case 'MSCU':
      return `https://www.msc.com/track-a-shipment?agencyPath=msc&reference=${cleanBL}`;
    case 'CMAU':
      return `https://www.cma-cgm.com/ebusiness/tracking/search?reference=${cleanBL}`;
    case 'COSU':
      return `https://elines.coscoshipping.com/ebusiness/cargotracking/cargotracking.do?paramValue=${cleanBL}`;
    case 'OOLU':
      return `https://www.oocl.com/eng/ourservices/eservices/cargotracking/pages/cargotracking.aspx?BLN=${cleanBL}`;
    case 'EGLV':
      return `https://www.evergreen-line.com/emodal/stTrace/stTrace.do?param1=${cleanBL}`;
    case 'ONEY':
      return `https://ecomm.one-line.com/one-ecom/manage-shipment/track-trace/${cleanBL}`;
    case 'YMLU':
      return `https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx?BLNo=${cleanBL}`;
    case 'HLCU':
      return `https://www.hapag-lloyd.com/en/online-business/track/track-by-container.html?container=${cleanBL}`;
    case 'HDMU':
      return `https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp?ref_no=${cleanBL}`;
    case 'ZIMU':
      return `https://www.zim.com/tools/track-a-shipment?reference=${cleanBL}`;
    case 'PABV':
      return `https://www.pilship.com/en--/120.html?reference=${cleanBL}`;
    default:
      return carrier.trackingUrl;
  }
}

/**
 * Generates tracking URL for container numbers
 */
export function generateContainerTrackingUrl(containerNumber: string): string | null {
  const carrier = detectCarrierFromContainer(containerNumber);
  if (!carrier) {
    return null;
  }

  const cleanContainer = containerNumber.trim().replace(/[-\s]/g, '');

  switch (carrier.scacCode) {
    case 'MAEU':
      return `https://www.maersk.com/tracking/${cleanContainer}`;
    case 'MSCU':
      return `https://www.msc.com/track-a-shipment?agencyPath=msc&reference=${cleanContainer}`;
    case 'CMAU':
      return `https://www.cma-cgm.com/ebusiness/tracking/search?reference=${cleanContainer}`;
    case 'COSU':
      return `https://elines.coscoshipping.com/ebusiness/cargotracking/cargotracking.do?paramValue=${cleanContainer}`;
    case 'OOLU':
      return `https://www.oocl.com/eng/ourservices/eservices/cargotracking/pages/cargotracking.aspx?BLN=${cleanContainer}`;
    case 'EGLV':
      return `https://www.evergreen-line.com/emodal/stTrace/stTrace.do?param1=${cleanContainer}`;
    case 'ONEY':
      return `https://ecomm.one-line.com/one-ecom/manage-shipment/track-trace/${cleanContainer}`;
    case 'YMLU':
      return `https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx?BLNo=${cleanContainer}`;
    case 'HLCU':
      return `https://www.hapag-lloyd.com/en/online-business/track/track-by-container.html?container=${cleanContainer}`;
    case 'HDMU':
      return `https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp?ref_no=${cleanContainer}`;
    case 'ZIMU':
      return `https://www.zim.com/tools/track-a-shipment?reference=${cleanContainer}`;
    case 'PABV':
      return `https://www.pilship.com/en--/120.html?reference=${cleanContainer}`;
    default:
      // Only return official carrier tracking page, no fallbacks
      return carrier.trackingUrl;
  }
}

/**
 * Validates if a string is a valid bill of lading format
 */
export function isValidBLFormat(blNumber: string): boolean {
  if (!blNumber || typeof blNumber !== 'string') {
    return false;
  }

  const cleanBL = blNumber.trim().toUpperCase();
  
  // General SCAC + 9 digits pattern
  const generalPattern = /^[A-Z]{4}\d{9}$/;
  
  return generalPattern.test(cleanBL) && detectCarrierFromBL(cleanBL) !== null;
}

/**
 * Formats a bill of lading number for display
 */
export function formatBLNumber(blNumber: string): string {
  if (!blNumber) return '';
  return blNumber.trim().toUpperCase();
}