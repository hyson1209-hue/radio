import { test, expect } from '@playwright/test';

test('페이지가 로드되고 채널 UI가 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MBC충북 라디오/);
  await expect(page.getByRole('button', { name: /제1FM/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /제2FM/ })).toBeVisible();
});

test('방송 시간에는 프로그램 배경과 이름이 표시된다', async ({ page }) => {
  // 수요일 12:30 KST (03:30 UTC) — FM2 정오의 희망곡 시간대
  await page.clock.setFixedTime(new Date('2026-07-08T03:30:00Z'));
  await page.goto('/');
  await expect(page.locator('#onair-host')).toContainText('정오의 희망곡');
  await expect(page.locator('#program-bg')).toHaveClass(/show/);
  await expect(page.locator('#program-bg')).toHaveCSS('background-image', /jeongo-hope/);

  // FM1은 이 시간대 방송이 없으므로 배경이 사라진다
  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(page.locator('#onair-host')).toHaveText('');
  await expect(page.locator('#program-bg')).not.toHaveClass(/show/);
});

test('분 단위 편성이 정확히 적용된다 (시사ON 11:05 시작)', async ({ page }) => {
  // 수요일 11:03 KST — 시사ON 시작 전이므로 배경 없음
  await page.clock.setFixedTime(new Date('2026-07-08T02:03:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(page.locator('#onair-host')).toHaveText('');

  // 수요일 11:10 KST — 시사ON 방송 중
  await page.clock.setFixedTime(new Date('2026-07-08T02:10:00Z'));
  await page.reload();
  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(page.locator('#onair-host')).toContainText('시사ON');
  await expect(page.locator('#program-bg')).toHaveCSS('background-image', /sisa-on/);
});

test('제1FM 뉴스 시간에는 담당 아나운서가 표시된다', async ({ page }) => {
  // 수요일 12:02 KST (03:02 UTC) — 제1FM 12시 뉴스, 제2FM 정오의 희망곡
  await page.clock.setFixedTime(new Date('2026-07-08T03:02:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(page.locator('#onair-host')).toContainText('12시 뉴스');
  await expect(page.locator('#onair-host')).toContainText('이황주 아나운서');

  // 12:06에는 뉴스가 끝나 배경이 사라진다
  await page.clock.setFixedTime(new Date('2026-07-08T03:06:00Z'));
  await page.reload();
  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(page.locator('#onair-host')).toHaveText('');
});

test('방송 시간이 아니면 배경이 표시되지 않는다', async ({ page }) => {
  // 05:00 KST (전날 20:00 UTC) — 어떤 방송 시간대에도 해당 없음
  await page.clock.setFixedTime(new Date('2026-07-07T20:00:00Z'));
  await page.goto('/');
  await expect(page.locator('#onair-host')).toHaveText('');
  await expect(page.locator('#program-bg')).not.toHaveClass(/show/);
});

test('주말에는 평일 프로그램 배경이 표시되지 않는다', async ({ page }) => {
  // 토요일 12:30 KST (03:30 UTC)
  await page.clock.setFixedTime(new Date('2026-07-11T03:30:00Z'));
  await page.goto('/');
  await expect(page.locator('#onair-host')).toHaveText('');
  await expect(page.locator('#program-bg')).not.toHaveClass(/show/);
});

test('보이는 라디오를 켜고 끌 수 있다', async ({ page }) => {
  await page.goto('/');
  const frame = page.locator('#yt-frame');
  await expect(frame).toBeHidden();

  await page.getByRole('button', { name: '보이는 라디오' }).click();
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute('src', /youtube\.com\/embed/);

  await page.getByRole('button', { name: '보이는 라디오 닫기' }).click();
  await expect(frame).toBeHidden();
  await expect(frame).toHaveAttribute('src', '');
});

test('문자 참여 번호가 선택한 채널에 따라 바뀐다', async ({ page }) => {
  await page.goto('/');
  const sms = page.locator('#sms-btn');
  // 기본 채널은 제2FM
  await expect(sms).toHaveAttribute('href', 'sms:%230997');
  await expect(sms).toContainText('#0997');

  await page.getByRole('button', { name: /제1FM/ }).click();
  await expect(sms).toHaveAttribute('href', 'sms:%231071');
  await expect(sms).toContainText('#1071');
});

test('PWA 매니페스트와 서비스 워커가 동작한다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');

  const manifest = await page.request.get('/manifest.json');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');

  const swActive = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(swActive).toBe(true);
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
