import { test, expect } from '@playwright/test';

test('페이지가 로드되고 채널 UI가 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MBC충북 라디오/);
  await expect(page.getByRole('button', { name: /FM1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /FM2/ })).toBeVisible();
});

test('재생 버튼을 누르면 라이브 스트림이 재생된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '재생' }).click();

  const audio = page.locator('#audio');
  await expect
    .poll(async () => audio.evaluate((el: HTMLAudioElement) => !el.paused && el.readyState >= 2), {
      timeout: 30_000,
      message: '오디오가 재생 상태가 되어야 합니다',
    })
    .toBe(true);
  await expect(page.locator('#status')).toContainText('재생 중');
});
