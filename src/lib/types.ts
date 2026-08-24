export type Point = {
  x: number;
  y: number;
};

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ClaimStatus =
  | "reserved"
  | "payment_pending"
  | "owned"
  | "expired"
  | "cancelled"
  | "failed";

export type OwnedRegion = PixelRect & {
  id: string;
  color: string;
  destinationUrl: string;
  purchasedAt: string;
};

export type OwnershipManifest = {
  revision: number;
  generatedAt: string;
  regions: OwnedRegion[];
};

export type SelectionEvaluation = {
  rect: PixelRect;
  pixelCount: number;
  priceCents: number;
  valid: boolean;
  reason?: string;
};

export type ReservationStatus = {
  id: string;
  status: ClaimStatus;
  regionUrl: string | null;
  customerEmail: string | null;
  expiresAt: string;
  updatedAt: string;
};
