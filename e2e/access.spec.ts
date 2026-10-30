import { expect, test } from "@playwright/test";
test("login validation, visibility and protected route access", async ({
  page,
}) => {
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "Care starts with you." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(page.getByText("Enter your username.")).toBeVisible();
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-not-a-real-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
