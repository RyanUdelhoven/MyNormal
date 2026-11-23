import { test, expect } from "./fixtures";
test("trend steppers edit independently during delayed saves and persist each range", async ({
  page,
  request,
}) => {
  await page.route("**/api/journal", async (route) => {
    if (route.request().method() === "PUT")
      await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  const modes = [
    { tab: "Days YoY", label: "Weeks ahead", key: "ahead", value: "2" },
    { tab: "Days YoY", label: "Weeks past", key: "days", value: "41" },
    {
      tab: "Previous weekdays",
      label: "Weeks covered",
      key: "weekday",
      value: "19",
    },
    { tab: "Week flow", label: "Previous weeks", key: "week", value: "8" },
    { tab: "Year flow", label: "Previous years", key: "year", value: "6" },
  ];
  for (const mode of modes) {
    await page.getByRole("button", { name: mode.tab, exact: true }).click();
    const input = page.getByRole("spinbutton", {
      name: mode.label,
      exact: true,
    });
    await input.fill("");
    await expect(input).toHaveValue("");
    await input.fill(mode.value);
    await input.press("ArrowUp");
    await expect(input).toHaveValue(String(+mode.value + 1));
    await input.press("ArrowDown");
    await expect(input).toHaveValue(mode.value);
  }
  for (const mode of modes) {
    await page.getByRole("button", { name: mode.tab, exact: true }).click();
    await expect(
      page.getByRole("spinbutton", { name: mode.label, exact: true }),
    ).toHaveValue(mode.value);
  }
  await expect
    .poll(async () => {
      const response = await request.get("/api/journal");
      return (await response.json()).ranges;
    })
    .toEqual({ days: 41, ahead: 2, weekday: 19, week: 8, year: 6 });
  await page.reload();
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  for (const mode of modes) {
    await page.getByRole("button", { name: mode.tab, exact: true }).click();
    await expect(
      page.getByRole("spinbutton", { name: mode.label, exact: true }),
    ).toHaveValue(mode.value);
  }
  const year = page.getByRole("spinbutton", {
    name: "Previous years",
    exact: true,
  });
  await year.fill("101");
  await year.press("Tab");
  await expect(year).toHaveValue("6");
});

test("Days YoY covers seven calendar days per selected week", async ({
  page,
  request,
}) => {
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  const weeks = page.getByRole("spinbutton", {
    name: "Weeks past",
    exact: true,
  });
  await weeks.fill("1");
  await expect(page.locator(".data-details summary")).toContainText("7 dates");
  await weeks.press("ArrowUp");
  await expect(weeks).toHaveValue("2");
  await expect(page.locator(".data-details summary")).toContainText("14 dates");
  await expect
    .poll(async () => (await (await request.get("/api/journal")).json()).ranges)
    .toEqual({ days: 2, ahead: 0, weekday: 52, week: 12, year: 3 });
  await page.reload();
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Weeks past", exact: true }),
  ).toHaveValue("2");
  await expect(page.locator(".data-details summary")).toContainText("14 dates");
});

test("Weeks ahead extends the chart and resets invalid drafts", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-18T12:00:00") });
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  const ahead = page.getByRole("spinbutton", {
    name: "Weeks ahead",
    exact: true,
  });
  await expect(ahead).toHaveValue("0");
  await ahead.fill("2");
  await page.locator(".data-details summary").click();
  await expect(page.locator(".data-details tbody tr").first()).toContainText(
    "2026-12-02",
  );
  await expect(page.locator(".data-details summary")).toContainText(
    "224 dates",
  );
  await ahead.fill("-1");
  await ahead.press("Tab");
  await expect(ahead).toHaveValue("2");
  await ahead.fill("0");
  await expect(page.locator(".data-details tbody tr").first()).toContainText(
    "2026-11-18",
  );
});

test("Week flow switches comparison units and keeps independent counts", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Trends", exact: true }).click();
  await page.getByRole("button", { name: "Week flow", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "Compare previous years" });
  await expect(toggle).not.toBeChecked();
  await page
    .getByRole("spinbutton", { name: "Previous weeks", exact: true })
    .fill("8");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  const count = page.getByRole("spinbutton", {
    name: "Previous years",
    exact: true,
  });
  await expect(count).toHaveValue("2");
  await count.fill("1");
  await expect(page.locator(".stats")).toContainText("Past 1 year average");
  await count.fill("101");
  await count.press("Tab");
  await expect(count).toHaveValue("1");
  await toggle.click();
  await expect(
    page.getByRole("spinbutton", { name: "Previous weeks", exact: true }),
  ).toHaveValue("8");
  await toggle.click();
  await expect(count).toHaveValue("1");
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(toggle).toBeVisible();
  await expect(page.locator(".week-comparison")).toHaveText("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
