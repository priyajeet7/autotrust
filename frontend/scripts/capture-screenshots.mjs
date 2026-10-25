/**
 * Captures README screenshots from the REAL running app (no mocks).
 *
 * Prerequisites: backend on :4000 with a seeded database (`npm run db:seed`), frontend dev
 * server on :5173, and a locally installed Chrome. Then, from frontend/:
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node scripts/capture-screenshots.mjs
 *
 * It registers a fresh customer account and makes one real purchase, so it changes the data.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.APP_URL ?? 'http://localhost:5173';
const OUT_DIR = new URL('../../docs/screenshots/', import.meta.url);
const { SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPassword } = process.env;

if (!adminEmail || !adminPassword) {
  console.error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (the seeded admin account).');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome' });
const shot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT_DIR)) });

try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });

  // 1. Sign-in page
  await page.goto(BASE_URL);
  await page.getByRole('heading', { name: 'Sign in to AutoTrust' }).waitFor();
  await shot(page, '01-login');

  // 2. Register a new customer -> customer dashboard
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('Riya Kapoor');
  await page.getByLabel('Email').fill(`riya.${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('customer-pass-123');
  await shot(page, '02-register');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('heading', { name: 'Toyota Corolla' }).waitFor();
  await shot(page, '03-dashboard-customer');

  // 3. Search
  await page.getByRole('search').getByLabel('Make').fill('toyota');
  await page.getByRole('search').getByLabel('Max price').fill('30000');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByText('matching your search').waitFor();
  await shot(page, '04-search');

  // 4. Purchase
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Toyota Corolla' }) })
    .getByRole('button', { name: 'Purchase' })
    .click();
  await page.getByRole('status').waitFor();
  await shot(page, '05-purchase');

  // 5. Admin dashboard and add-vehicle form
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Add vehicle' }).waitFor();
  await shot(page, '06-dashboard-admin');
  await page.getByRole('button', { name: 'Add vehicle' }).click();
  await page.getByRole('form', { name: 'Vehicle details' }).waitFor();
  await shot(page, '07-admin-add-vehicle');

  // 6. Mobile layout
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE_URL);
  await mobile.getByLabel('Email').fill(adminEmail);
  await mobile.getByLabel('Password').fill(adminPassword);
  await mobile.getByRole('button', { name: 'Sign in' }).click();
  await mobile.getByRole('heading', { name: 'Toyota Corolla' }).waitFor();
  await shot(mobile, '08-mobile');

  console.log(`Saved screenshots to ${fileURLToPath(OUT_DIR)}`);
} finally {
  await browser.close();
}
