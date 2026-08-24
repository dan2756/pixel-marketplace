import { expect, test } from "@playwright/test";

const reservationId = "550e8400-e29b-41d4-a716-446655440000";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        revision: 7,
        generatedAt: new Date().toISOString(),
        regions: [
          {
            id: "660e8400-e29b-41d4-a716-446655440000",
            x: 100,
            y: 100,
            width: 20,
            height: 20,
            color: "#E85D44",
            destinationUrl: "https://example.com/",
            purchasedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("pixel-marketplace-coachmark", "dismissed");
  });
});

test("desktop selection reaches a webhook-confirmed purchase status", async ({ page }) => {
  await page.route("**/api/checkout", async (route) => {
    const request = route.request();
    const body = request.postDataJSON();
    expect(body.rect.width * body.rect.height).toBeGreaterThanOrEqual(100);
    expect(body.destinationUrl).toBe("https://example.org/portfolio");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        reservationId,
        checkoutUrl: `/success?reservation_id=${reservationId}&session_id=cs_test`,
        expiresAt: new Date(Date.now() + 31 * 60_000).toISOString(),
      }),
    });
  });
  await page.route(`**/api/status/${reservationId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: reservationId,
        status: "owned",
        regionUrl: `/r/${reservationId}`,
        customerEmail: "bu•••@example.org",
        expiresAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
  });

  await page.goto("/?x=640&y=360&z=1");
  await expect(page.getByText("revision 7")).toBeVisible();
  await page.getByRole("button", { name: "Select pixels" }).click();

  const canvas = page.getByRole("application", {
    name: "Interactive 1280 by 720 pixel ownership canvas",
  });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 340, bounds!.y + 320);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 390, bounds!.y + 350, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByRole("heading", { name: "Configure selection" })).toBeVisible();
  await page.getByLabel("Hex color").fill("#1D9E75");
  await page.getByLabel("Destination URL").fill("example.org/portfolio");
  await page.getByLabel("Destination URL").blur();
  await page.getByRole("button", { name: "Continue to secure checkout" }).click();

  await expect(page).toHaveURL(new RegExp(`/success\\?reservation_id=${reservationId}`));
  await expect(page.getByRole("heading", { name: "Your pixels are live" })).toBeVisible();
  await expect(page.getByRole("link", { name: /View permanent region/ })).toBeVisible();
});

test("deep-link viewport and keyboard selection are accessible", async ({ page }) => {
  await page.goto("/?x=42&y=84&z=8");
  await expect(page.getByText("800%")).toBeVisible();

  const canvas = page.getByRole("application", {
    name: "Interactive 1280 by 720 pixel ownership canvas",
  });
  await canvas.focus();
  await canvas.press("Enter");
  await expect(page.getByRole("heading", { name: "Configure selection" })).toBeVisible();
  await expect(page.getByText("100").first()).toBeVisible();

  await canvas.press("Shift+ArrowRight");
  await expect(page.getByText("110").first()).toBeVisible();
  await expect(page.getByText(/Select at least 100 pixels/)).toHaveCount(0);
  await expect(page.getByText(/Width and height must each be at least 4/)).toHaveCount(0);
  await expect(page).toHaveURL(/x=.*&y=.*&z=8/);
});

test("payment status visibly waits for webhook fulfillment", async ({ page }) => {
  let calls = 0;
  await page.route(`**/api/status/${reservationId}`, async (route) => {
    calls += 1;
    const owned = calls > 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: reservationId,
        status: owned ? "owned" : "reserved",
        regionUrl: owned ? `/r/${reservationId}` : null,
        customerEmail: owned ? "bu•••@example.org" : null,
        expiresAt: new Date(Date.now() + 31 * 60_000).toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
  });

  await page.goto(`/success?reservation_id=${reservationId}&session_id=cs_test`);
  await expect(page.getByRole("heading", { name: "Confirming your purchase" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your pixels are live" })).toBeVisible({
    timeout: 8_000,
  });
});
