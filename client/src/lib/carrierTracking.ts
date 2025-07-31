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
    blPattern: /^MAEU\d{9}$/,
    containerPrefixes: ["MAEU", "MSKU", "MRKU"]
  },
  {
    name: "Mediterranean Shipping Company (MSC)",
    scacCode: "MSCU",
    trackingUrl: "https://www.msc.com/en/track-a-shipment",
    blPattern: /^(MSCU|MEDU)\d{9}$/,
    containerPrefixes: ["MSCU", "MEDU", "MSMU"]
  },
  {
    name: "CMA CGM",
    scacCode: "CMAU",
    trackingUrl: "https://www.cma-cgm.com/ebusiness/tracking",
    blPattern: /^(CMAU|CMDU)\d{9}$/,
    containerPrefixes: ["CMAU", "CMDU"]
  },
  {
    name: "COSCO Shipping Lines",
    scacCode: "COSU",
    trackingUrl: "https://elines.coscoshipping.com/ebusiness/cargotracking",
    blPattern: /^COSU\d{9}$/,
    containerPrefixes: ["COSU", "COCU", "CBHU"]
  },
  {
    name: "Orient Overseas Container Line (OOCL)",
    scacCode: "OOLU",
    trackingUrl: "https://www.oocl.com/eng/ourservices/eservices/cargotracking/pages/cargotracking.aspx",
    blPattern: /^OOLU\d{9}$/,
    containerPrefixes: ["OOLU"]
  },
  {
    name: "Evergreen Marine",
    scacCode: "EGLV",
    trackingUrl: "https://www.evergreen-line.com/emodal/stTrace/stTrace.do",
    blPattern: /^EGLV\d{9}$/,
    containerPrefixes: ["EGLV"]
  },
  {
    name: "Hapag-Lloyd",
    scacCode: "HLCU",
    trackingUrl: "https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html",
    blPattern: /^HLCU\d{9}$/,
    containerPrefixes: ["HLCU"]
  },
  {
    name: "ONE (Ocean Network Express)",
    scacCode: "ONEY",
    trackingUrl: "https://ecomm.one-line.com/one-cyberport/Tracking",
    blPattern: /^ONEY\d{9}$/,
    containerPrefixes: ["ONEY"]
  },
  {
    name: "Yang Ming Line",
    scacCode: "YMLU",
    trackingUrl: "https://www.yangming.com/e-service/Track_Trace/track_trace_cargo_tracking.aspx",
    blPattern: /^YMLU\d{9}$/,
    containerPrefixes: ["YMLU", "YMPR", "YMSG", "YMJA"]
  },
  {
    name: "ZIM Integrated Shipping Services",
    scacCode: "ZIMU",
    trackingUrl: "https://www.zim.com/tools/track-a-shipment",
    blPattern: /^ZIMU\d{9}$/,
    containerPrefixes: ["ZIMU"]
  },
  {
    name: "Hyundai Merchant Marine (HMM)",
    scacCode: "HDMU",
    trackingUrl: "https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.jsp",
    blPattern: /^HDMU\d{9}$/,
    containerPrefixes: ["HDMU"]
  },
  // Generic patterns for non-SCAC BL numbers (forwarders, smaller carriers)
  {
    name: "Generic Ocean Carrier",
    scacCode: "GENERIC",
    trackingUrl: "https://www.track-trace.com/container",
    blPattern: /^\d{8,12}$/,  // 8-12 digit numeric BL numbers
    containerPrefixes: []
  },
  {
    name: "Mixed Alphanumeric Carrier",
    scacCode: "MIXED",
    trackingUrl: "https://www.searates.com/container/tracking/",
    blPattern: /^[A-Z]{2,6}\d{6,10}$/,  // 2-6 letters + 6-10 digits
    containerPrefixes: []
  },
  {
    name: "Forwarding Agent BL",
    scacCode: "FORWARDER", 
    trackingUrl: "https://www.track-trace.com/container",
    blPattern: /^[A-Z0-9]{8,15}$/,  // Mixed alphanumeric 8-15 chars
    containerPrefixes: []
  }
];

/**
 * Detects the ocean carrier from a bill of lading number
 */
export function detectCarrierFromBL(blNumber: string): CarrierInfo | null {
  if (!blNumber || typeof blNumber !== 'string') {
    return null;
  }

  const cleanBL = blNumber.trim().toUpperCase();
  
  for (const carrier of OCEAN_CARRIERS) {
    if (carrier.blPattern.test(cleanBL)) {
      return carrier;
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
  
  for (const carrier of OCEAN_CARRIERS) {
    if (carrier.containerPrefixes.includes(prefix)) {
      return carrier;
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

  // For most carriers, we'll use their general tracking page
  // Some carriers have specific URL patterns for direct linking
  switch (carrier.scacCode) {
    case 'MAEU':
      return `${carrier.trackingUrl}?tracking=${blNumber}`;
    case 'MSCU':
      return `${carrier.trackingUrl}?trackingNumber=${blNumber}`;
    case 'CMAU':
      return `${carrier.trackingUrl}?trackingNumber=${blNumber}`;
    case 'GENERIC':
      return `${carrier.trackingUrl}?number=${blNumber}`;
    case 'MIXED':
      return `${carrier.trackingUrl}?container=${blNumber}`;
    case 'FORWARDER':
      return `${carrier.trackingUrl}?number=${blNumber}`;
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

  switch (carrier.scacCode) {
    case 'MAEU':
      return `${carrier.trackingUrl}?tracking=${containerNumber}`;
    case 'MSCU':
      return `${carrier.trackingUrl}?trackingNumber=${containerNumber}`;
    case 'CMAU':
      return `${carrier.trackingUrl}?trackingNumber=${containerNumber}`;
    default:
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