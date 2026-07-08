import { test, expect } from '@playwright/test';

test('페이지가 로드되고 채널 UI가 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MBC충북 라디오/);
  await expect(page.getByRole('button', { name: /FM1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /FM2/ })).toBeVisible();
});

test('방송 시간에는 아나운서 배경과 이름이 표시된다', async ({ page }) => {
  // 12:30 KST (03:30 UTC) — FM2 박서영 아나운서 시간대
  await page.clock.setFixedTime(new Date('2026-07-08T03:30:00Z'));
  await page.goto('/');
  await expect(page.locator('#onair-host')).toContainText('박서영 아나운서');
  await expect(page.locator('#announcer-bg')).toHaveClass(/show/);
  await expect(page.locator('#announcer-bg')).toHaveCSS('background-image', /park-seoyoung/);

  // FM1은 이 시간대 방송이 없으므로 배경이 사라진다
  await page.getByRole('button', { name: /FM1/ }).click();
  await expect(page.locator('#onair-host')).toHaveText('');
  await expect(page.locator('#announcer-bg')).not.toHaveClass(/show/);
});

test('방송 시간이 아니면 배경이 표시되지 않는다', async ({ page }) => {
  // 05:00 KST (전날 20:00 UTC) — 어떤 방송 시간대에도 해당 없음
  await page.clock.setFixedTime(new Date('2026-07-07T20:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#onair-host')).toHaveText('');
  await expect(page.locator('#announcer-bg')).not.toHaveClass(/show/);
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
