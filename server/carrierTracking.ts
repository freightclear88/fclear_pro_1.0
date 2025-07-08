// Ocean carrier tracking utilities for server-side processing
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
 * Generates a direct tracking URL for a bill of lading number
 */
export function generateTrackingUrl(blNumber: string): string | null {
  const carrier = detectCarrierFromBL(blNumber);
  if (!carrier) {
    return null;
  }

  // For most carriers, we'll use their general tracking page
  switch (carrier.scacCode) {
    case 'MAEU':
      return `${carrier.trackingUrl}?tracking=${blNumber}`;
    case 'MSCU':
      return `${carrier.trackingUrl}?trackingNumber=${blNumber}`;
    case 'CMAU':
      return `${carrier.trackingUrl}?trackingNumber=${blNumber}`;
    default:
      return carrier.trackingUrl;
  }
}

/**
 * Generates tracking URL for container numbers
 */
export function generateContainerTrackingUrl(containerNumber: string): string | null {
  if (!containerNumber || typeof containerNumber !== 'string') {
    return null;
  }

  const cleanContainer = containerNumber.trim().toUpperCase();
  const prefix = cleanContainer.substring(0, 4);
  
  for (const carrier of OCEAN_CARRIERS) {
    if (carrier.containerPrefixes.includes(prefix)) {
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
  }

  return null;
}