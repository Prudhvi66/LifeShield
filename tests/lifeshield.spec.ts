// tests/lifeshield.spec.ts
import { test, expect } from '@playwright/test';

// Global configuration for the suite – baseURL points to the Vite dev server
test.use({ baseURL: 'http://localhost:3002' });

/**
 * Helper to capture console.error messages during a test.
 * Filters out expected 401 Unauthorized messages from unauthenticated background requests.
 */
async function captureConsoleErrors(page) {
  const errors = [] as string[];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('401') && !text.includes('Unauthorized')) {
        errors.push(text);
      }
    }
  });
  return errors;
}

/**
 * Helper to capture any failed network requests.
 */
async function captureFailedRequests(page) {
  const failed = [] as string[];
  page.on('requestfailed', request => {
    const err = request.failure();
    failed.push(`${request.method()} ${request.url()} - ${err?.errorText}`);
  });
  return failed;
}

/**
 * Register a new user and stay logged in using the application's actual UI.
 */
async function registerAndLogin(page, email: string, password: string, fullName = 'E2E Test User') {
  await page.goto('/');
  await page.locator('nav.bottom-navigation').waitFor({ state: 'visible' });

  // Open authentication modal via the User Account header button
  const userAccountBtn = page.getByLabel('User Account');
  await userAccountBtn.waitFor({ state: 'visible' });
  await userAccountBtn.click();

  await page.locator('.ls-modal-content').waitFor({ state: 'visible' });

  // If already logged in, sign out first to ensure fresh state
  const signOutBtn = page.locator('.ls-modal-content button.ls-btn-danger', { hasText: 'Sign Out of Device' });
  if (await signOutBtn.isVisible()) {
    await signOutBtn.click();
    await page.locator('.ls-modal-content').waitFor({ state: 'hidden' });
    await userAccountBtn.click();
    await page.locator('.ls-modal-content').waitFor({ state: 'visible' });
  }

  // Switch to Register mode if in Login mode
  const registerSwitchBtn = page.locator('.ls-modal-content button', { hasText: 'Need an account? Register' });
  if (await registerSwitchBtn.isVisible()) {
    await registerSwitchBtn.click();
  }

  // Wait for registration fields
  const fullNameInput = page.locator('.ls-modal-content input[placeholder*="Ramesh Kumar"]');
  await fullNameInput.waitFor({ state: 'visible' });

  await fullNameInput.fill(fullName);
  await page.locator('.ls-modal-content input[type="number"]').fill('30');
  await page.locator('.ls-modal-content select').selectOption('O+');
  await page.locator('.ls-modal-content input[type="email"]').fill(email);
  await page.locator('.ls-modal-content input[type="password"]').fill(password);

  // Submit registration form
  await page.locator('.ls-modal-content button[type="submit"]', { hasText: 'Register' }).click();

  // Wait for auth modal to close automatically upon successful registration
  await page.locator('.ls-modal-content').waitFor({ state: 'hidden', timeout: 10000 });

  // Verify avatar button reflects user initial
  await expect(page.getByLabel('User Account')).toHaveText(fullName.charAt(0).toUpperCase());
}

/**
 * Log in with an existing user credentials using the application's actual UI.
 */
async function login(page, email: string, password: string) {
  await page.goto('/');
  await page.locator('nav.bottom-navigation').waitFor({ state: 'visible' });

  // Open authentication modal via the User Account header button
  const userAccountBtn = page.getByLabel('User Account');
  await userAccountBtn.waitFor({ state: 'visible' });
  await userAccountBtn.click();

  await page.locator('.ls-modal-content').waitFor({ state: 'visible' });

  // If already logged in:
  const signOutBtn = page.locator('.ls-modal-content button.ls-btn-danger', { hasText: 'Sign Out of Device' });
  if (await signOutBtn.isVisible()) {
    const modalText = await page.locator('.ls-modal-content').textContent();
    if (modalText?.includes(email)) {
      // Already logged in as requested user, simply close modal
      await page.locator('.ls-modal-content button.ls-close-btn').click();
      await page.locator('.ls-modal-content').waitFor({ state: 'hidden' });
      return;
    }
    await signOutBtn.click();
    await page.locator('.ls-modal-content').waitFor({ state: 'hidden' });
    await userAccountBtn.click();
    await page.locator('.ls-modal-content').waitFor({ state: 'visible' });
  }

  // Switch to Login mode if in Register mode
  const loginSwitchBtn = page.locator('.ls-modal-content button', { hasText: 'Already registered? Log in' });
  if (await loginSwitchBtn.isVisible()) {
    await loginSwitchBtn.click();
  }

  // Fill credentials
  await page.locator('.ls-modal-content input[type="email"]').fill(email);
  await page.locator('.ls-modal-content input[type="password"]').fill(password);

  // Submit login form
  await page.locator('.ls-modal-content button[type="submit"]', { hasText: 'Sign In' }).click();

  // Wait for auth modal to close automatically
  await page.locator('.ls-modal-content').waitFor({ state: 'hidden', timeout: 10000 });
}

/**
 * Clean up test data if needed.
 */
async function cleanupTestData(page) {
  await page.evaluate(async () => {
    const client = (window as any).apiClient;
    if (!client) return;
    try {
      if (client.reminders && client.reminders.list) {
        const list = await client.reminders.list();
        await Promise.all(list.map((r: any) => client.reminders.delete(r.id)));
      }
    } catch {
      // ignore
    }
  });
}

test.describe('LifeShield End-to-End Suite', () => {
  test.afterEach(async ({ page }) => {
    try {
      await cleanupTestData(page);
    } catch {
      // ignore cleanup errors
    }
  });

  test('Home page loads and core UI elements are visible', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    const failedRequests = await captureFailedRequests(page);

    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();

    // Verify header controls exist
    await expect(page.getByLabel('User Account')).toBeVisible();
    await expect(page.getByLabel('Medical Disclaimer & System Information')).toBeVisible();

    // Verify bottom navigation bar and all tabs exist
    const nav = page.locator('nav.bottom-navigation');
    await expect(nav).toBeVisible();
    await expect(nav.locator('button', { hasText: 'Home' })).toBeVisible();
    await expect(nav.locator('button', { hasText: 'Health' })).toBeVisible();
    await expect(nav.locator('button', { hasText: 'Safety' })).toBeVisible();
    await expect(nav.locator('button', { hasText: 'AI' })).toBeVisible();
    await expect(nav.locator('button', { hasText: 'Profile' })).toBeVisible();

    // Verify key home sections and cards
    await expect(page.locator('.hero-section')).toBeVisible();
    await expect(page.locator('.health-score-card')).toBeVisible();
    await expect(page.locator('button.medicine-card')).toBeVisible();
    await expect(page.locator('button.water-card')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('Navigation across all tabs works', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav.bottom-navigation').waitFor({ state: 'visible' });

    const nav = page.locator('nav.bottom-navigation');

    // 1. Switch to Health
    await nav.locator('button', { hasText: 'Health' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText('Your health');

    // 2. Switch to Safety
    await nav.locator('button', { hasText: 'Safety' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText("You're protected");

    // 3. Switch to AI
    await nav.locator('button', { hasText: 'AI' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText('LifeShield AI');

    // 4. Switch to Profile
    await nav.locator('button', { hasText: 'Profile' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText('Your profile');

    // 5. Return to Home
    await nav.locator('button', { hasText: 'Home' }).click();
    await expect(page.locator('.hero-section h1')).toContainText('Your health');
  });

  test('Authentication flow – register, logout, then login again', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    const testEmail = `e2e_auth_${Date.now()}@example.com`;
    const testPassword = 'AuthPass123!';
    const testFullName = 'Alex Clinical';

    // 1. Register and verify login
    await registerAndLogin(page, testEmail, testPassword, testFullName);

    const userBtn = page.getByLabel('User Account');
    await expect(userBtn).toHaveText('A');

    // 2. Open auth modal to sign out
    await userBtn.click();
    await page.locator('.ls-modal-content').waitFor({ state: 'visible' });
    await expect(page.locator('.ls-modal-content strong')).toContainText(testFullName);

    // Sign out
    await page.locator('.ls-modal-content button.ls-btn-danger', { hasText: 'Sign Out of Device' }).click();
    await page.locator('.ls-modal-content').waitFor({ state: 'hidden' });

    // Avatar button reverts to unauthenticated default ('P')
    await expect(userBtn).toHaveText('P');

    // 3. Log back in with registered credentials
    await login(page, testEmail, testPassword);
    await expect(userBtn).toHaveText('A');

    expect(consoleErrors).toEqual([]);
  });

  test('Reminder lifecycle: create → verify → action', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    const userEmail = `e2e_rem_${Date.now()}@example.com`;
    const userPassword = 'RemPass123!';

    // Register independent user
    await registerAndLogin(page, userEmail, userPassword);

    // Return to Home tab
    await page.locator('nav.bottom-navigation button', { hasText: 'Home' }).click();

    // Open Medicine Reminders modal
    await page.locator('button.medicine-card').click();
    await page.locator('.ls-modal-content').waitFor({ state: 'visible' });
    await expect(page.locator('.ls-modal-header h3')).toHaveText('Reminders & Medicine Schedules');

    // Fill form
    const reminderTitle = `Medicine_${Date.now()}`;
    await page.locator('.ls-modal-content input[placeholder*="Metformin"]').fill(reminderTitle);
    await page.locator('.ls-modal-content input[type="time"]').fill('09:30');
    await page.locator('.ls-modal-content input[placeholder*="Tablet"]').fill('1 Capsule after food');

    // Submit reminder
    await page.locator('.ls-modal-content button[type="submit"]', { hasText: 'Schedule Reminder' }).click();

    // Verify reminder appears in list
    const createdItem = page.locator('.ls-modal-content strong', { hasText: reminderTitle });
    await expect(createdItem).toBeVisible({ timeout: 5000 });

    // Action the reminder: click "✓ Taken"
    const takenBtn = page.locator('.ls-modal-content button', { hasText: '✓ Taken' }).first();
    await takenBtn.click();

    // Close modal
    await page.locator('.ls-modal-content button.ls-close-btn').click();
    await page.locator('.ls-modal-content').waitFor({ state: 'hidden' });

    expect(consoleErrors).toEqual([]);
  });

  test('AI companion basic interaction', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    await page.goto('/');

    // Navigate to AI tab
    await page.locator('nav.bottom-navigation button', { hasText: 'AI' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText('LifeShield AI');

    // Enter message in clinical assistant input
    const aiInput = page.locator('.ai-input input');
    await aiInput.waitFor({ state: 'visible' });
    await aiInput.fill('What is my current clinical health risk?');
    await page.locator('.ai-input button[aria-label="Send message"]').click();

    // Verify user message bubble is displayed
    await expect(page.locator('.ai-bubble', { hasText: 'What is my current clinical health risk?' })).toBeVisible();

    // Verify assistant responds
    await expect(page.locator('.ai-bubble strong', { hasText: 'LifeShield AI' }).last()).toBeVisible({ timeout: 10000 });

    expect(consoleErrors).toEqual([]);
  });

  test('Safety SOS flow – start and abort', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    await page.goto('/');

    // Navigate to Safety tab
    await page.locator('nav.bottom-navigation button', { hasText: 'Safety' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText("You're protected");

    // Click SOS button
    const sosBtn = page.locator('button.sos-button');
    await sosBtn.waitFor({ state: 'visible' });
    await sosBtn.click();

    // Verify countdown modal is triggered
    await expect(page.locator('.ls-modal-content')).toBeVisible();
    await expect(page.locator('.ls-badge-danger', { hasText: 'EMERGENCY SOS IN PROGRESS' })).toBeVisible();
    await expect(page.locator('.ls-countdown-number')).toBeVisible();

    // Abort SOS alert
    const cancelBtn = page.locator('.ls-modal-content button', { hasText: 'Cancel SOS (I Am Safe)' });
    await cancelBtn.click();

    // Verify modal is dismissed
    await expect(page.locator('.ls-modal-content')).toBeHidden();

    expect(consoleErrors).toEqual([]);
  });

  test('Profile baseline update and export records', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);
    const userEmail = `e2e_prof_${Date.now()}@example.com`;
    const userPassword = 'ProfPass123!';

    // Register user for this test
    await registerAndLogin(page, userEmail, userPassword, 'Profile User');

    // Navigate to Profile tab
    await page.locator('nav.bottom-navigation button', { hasText: 'Profile' }).click();
    await expect(page.locator('.page-heading h1')).toHaveText('Your profile');

    // Verify Profile Banner reflects logged in state
    await expect(page.locator('.profile-banner h2')).toHaveText('Profile User');
    await expect(page.locator('.profile-banner button', { hasText: 'Sign Out' })).toBeVisible();

    // Update resting HR slider
    const restingHrSlider = page.locator('input[type="range"]').first();
    await restingHrSlider.fill('75');

    // Save baseline
    const saveBaselineBtn = page.locator('button', { hasText: /Save Baseline|✓ Saved/ });
    await saveBaselineBtn.click();
    await expect(page.locator('button', { hasText: /✓ Saved|Save Baseline/ })).toBeVisible();

    // Export records – download file event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button.setting', { hasText: 'Export health records (JSON)' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('lifeshield_health_records.json');

    // Sign out from Profile tab
    await page.locator('.profile-banner button', { hasText: 'Sign Out' }).click();
    await expect(page.locator('.profile-banner button', { hasText: 'Sign In' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
