
import { test, expect, Page } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const LOGIN_URL =
  process.env.MOVEO_URL ??
  'https://app-uat.moveo.allence.cloud/auth/sign-in';

const EMAIL = process.env.TEST_USER;
const PASSWORD = process.env.TEST_PASSWORD;

const SCREENSHOT_DIR = path.resolve('artifacts/login');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

// Champs du formulaire Moveo
function emailField(page: Page) {
  return page.getByRole('textbox', { name: 'E-mail' });
}

function passwordField(page: Page) {
  return page.getByPlaceholder('Saisissez votre mot de passe');
}

function submitButton(page: Page) {
  return page.getByRole('button', {
    name: 'Se connecter à Moveo',
  });
}

function forgotPasswordLink(page: Page) {
  return page.getByRole('link', {
    name: /mot de passe oublié/i,
  });
}

// Capture d'écran
async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

// Remplir les champs, y compris avec des valeurs vides
async function fillCredentials(
  page: Page,
  email: string,
  password: string,
) {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
}

// Ouvrir et vérifier le formulaire
async function openLogin(page: Page) {
  await page.goto(LOGIN_URL, {
    waitUntil: 'domcontentloaded',
  });

  await expect(emailField(page)).toBeVisible({ timeout: 15000 });
  await expect(passwordField(page)).toBeVisible({ timeout: 15000 });
  await expect(submitButton(page)).toBeVisible({ timeout: 15000 });
}

test.beforeEach(async ({ page }) => {
  await openLogin(page);
});

// TEST 01 : afficher la page de connexion
test('01 - Afficher la page de connexion', async ({ page }) => {
  await expect(emailField(page)).toBeVisible();
  await expect(passwordField(page)).toBeVisible();
  await expect(submitButton(page)).toBeVisible();

  await capture(page, '01-login-page');
});

// TEST 02 : email mal formaté
test('02 - Refuser un email mal formaté', async ({ page }) => {
  await fillCredentials(page, 'email-invalide', 'Test123!');

  await submitButton(page).click();

  // Un champ HTML de type email doit refuser ce format.
  const emailValidity = await emailField(page).evaluate(
    (element: HTMLInputElement) => ({
      type: element.type,
      valid: element.validity.valid,
      typeMismatch: element.validity.typeMismatch,
    }),
  );

  if (emailValidity.type === 'email') {
    expect(emailValidity.typeMismatch).toBe(true);
  } else {
    // Si la validation est personnalisée, vérifier que la connexion
    // n'a pas abouti.
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  }

  await capture(page, '02-invalid-email');
});

// TEST 03 : formulaire vide
test('03 - Refuser un formulaire vide', async ({ page }) => {
  await fillCredentials(page, '', '');
  await submitButton(page).click();

  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(passwordField(page)).toHaveAttribute('aria-invalid', 'true');

  await capture(page, '03-empty-form');
});

// TEST 04 : email vide
test('04 - Refuser un email vide', async ({ page }) => {
  await fillCredentials(page, '', 'Test123!');
  await submitButton(page).click();

  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true');

  await capture(page, '04-empty-email');
});

// TEST 05 : mot de passe vide
test('05 - Refuser un mot de passe vide', async ({ page }) => {
  await fillCredentials(page, 'test@example.com', '');
  await submitButton(page).click();

  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await expect(passwordField(page)).toHaveAttribute('aria-invalid', 'true');

  await capture(page, '05-empty-password');
});

// TEST 06 : mot de passe incorrect
test('06 - Refuser un mot de passe incorrect', async ({ page }) => {
  test.skip(!EMAIL, 'TEST_USER absent du fichier .env');

  await fillCredentials(
    page,
    EMAIL!,
    'MotDePasseIncorrect123!',
  );

  await submitButton(page).click();

  // La page doit rester sur la connexion si les identifiants sont refusés.
  await expect(page).toHaveURL(/\/auth\/sign-in/, {
    timeout: 15000,
  });

  await capture(page, '06-wrong-password');
});

// TEST 07 : connexion avec les identifiants du fichier .env
test('07 - Connexion avec des identifiants valides', async ({ page }) => {
  test.skip(
    !EMAIL || !PASSWORD,
    'TEST_USER ou TEST_PASSWORD absent du fichier .env',
  );

  await fillCredentials(page, EMAIL!, PASSWORD!);
  await submitButton(page).click();

  // Vérifier que l'utilisateur quitte la page de connexion.
  await expect(page).not.toHaveURL(
    /\/auth\/sign-in(?:[?#].*)?$/i,
    { timeout: 20000 },
  );

  await capture(page, '07-login-success');
});

// TEST 08 : connexion avec la touche Entrée
test('08 - Connexion avec Entrée', async ({ page }) => {
  test.skip(
    !EMAIL || !PASSWORD,
    'TEST_USER ou TEST_PASSWORD absent du fichier .env',
  );

  await fillCredentials(page, EMAIL!, PASSWORD!);
  await passwordField(page).press('Enter');

  await expect(page).not.toHaveURL(
    /\/auth\/sign-in(?:[?#].*)?$/i,
    { timeout: 20000 },
  );

  await capture(page, '08-login-enter');
});

// TEST 09 : mot de passe masqué par défaut
test('09 - Vérifier le masquage du mot de passe', async ({ page }) => {
  await expect(passwordField(page)).toHaveAttribute('type', 'password');

  await capture(page, '09-password-hidden');
});

// TEST 10 : lien mot de passe oublié
test('10 - Vérifier le lien mot de passe oublié', async ({ page }) => {
  await expect(forgotPasswordLink(page)).toBeVisible();

  await capture(page, '10-forgot-password');
});
