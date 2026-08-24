import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        revision: 1,
        generatedAt: new Date().toISOString(),
        regions: [],
      }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("pixel-marketplace-coachmark", "dismissed");
  });
});

test("mobile mode and non-drag coordinate selection expose a bottom sheet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const canvas = page.getByRole("application", {
    name: "Interactive 1280 by 720 pixel ownership canvas",
  });
  await canvas.focus();
  await canvas.press("Enter");
  await canvas.press("Shift+ArrowDown");

  const inspector = page.getByLabel("Selection inspector");
  await expect(inspector).toBeVisible();
  await expect(page.getByRole("heading", { name: "Configure selection" })).toBeVisible();

  await page.getByLabel("X", { exact: true }).fill("12");
  await page.getByLabel("Y", { exact: true }).fill("24");
  await page.getByLabel("W", { exact: true }).fill("12");
  await page.getByLabel("H", { exact: true }).fill("10");
  await expect(page.getByText("120", { exact: true }).first()).toBeVisible();
});

test("mobile minimap can collapse without hiding canvas controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse minimap" }).click();
  await expect(page.getByRole("button", { name: "Expand minimap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Explore", exact: true })).toBeVisible();
});
