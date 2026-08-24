export const BOARD_WIDTH = 1280;
export const BOARD_HEIGHT = 720;
export const BOARD_CELL_COUNT = BOARD_WIDTH * BOARD_HEIGHT;
// Million-pixel branding was considered and rejected. 1,000,000 pixels is not a
// clean 16:9 integer (1333.33×750); the closest 16:9 options make the UI worse.
// This canvas is an honest 720p frame: 1280×720 = 921,600 pixels.

export const UNIT_PRICE_CENTS = 25;
export const FOUNDING_PRICE_CENTS = 20;
export const FOUNDING_PIXEL_CAP = 10_000;

export const MIN_SELECTION_PIXELS = 100;
export const MIN_SELECTION_WIDTH = 4;
export const MIN_SELECTION_HEIGHT = 4;
export const MAX_SELECTION_PIXELS = 10_000;
export const SUGGESTED_STARTER_SIZE = 10;

// Stripe's $0.50 floor is an implementation detail, not a product minimum.
// The 100-pixel floor is well above it and is the figure we show in UX.
export const MIN_CHARGE_CENTS = MIN_SELECTION_PIXELS * FOUNDING_PRICE_CENTS;

export const RESERVATION_LEASE_MINUTES = 31;

export const MIN_ZOOM = 0.08;
export const MAX_ZOOM = 64;
export const GRID_LOD_ZOOM = 7;
export const DETAIL_LOD_ZOOM = 16;

export const DEFAULT_COLOR = "#6857F5";
export const BOARD_BACKGROUND = "#F3F2EE";

export const PRODUCT_NAME = "720p Frame";
export const PRODUCT_TAGLINE = "One 720p frame. 921,600 pixels. Sold once.";
