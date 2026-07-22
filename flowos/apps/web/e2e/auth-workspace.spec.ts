import { expect, test } from "@playwright/test";

test("unauthenticated Analytics access shows a sign-in gate", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Sign in to use Analytics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("sign-in page exposes account creation and password recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
});

test("an active owner can select a workspace and open Analytics", async ({ page }) => {
  test.skip(!process.env.E2E_OWNER_EMAIL || !process.env.E2E_OWNER_PASSWORD || !process.env.E2E_WORKSPACE_ID, "Set E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, and E2E_WORKSPACE_ID for the live owner smoke test.");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const workspace = page.getByLabel("Analytics workspace");
  await expect(workspace).toBeVisible();
  await workspace.selectOption(process.env.E2E_WORKSPACE_ID!);
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});
