const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 / 14 Mobile viewport
    isMobile: true,
  });

  const page = await context.newPage();
  console.log('Navigating to https://barberclub.com.co/b/el-campincito ...');
  await page.goto('https://barberclub.com.co/b/el-campincito', { waitUntil: 'networkidle' });

  // Take screenshot of default Men's mode
  await page.screenshot({ path: 'C:/Users/jeloz/.gemini/antigravity/brain/112f3e2b-ee25-476a-8314-5639320b80b8/mobile_booking_men.png', fullPage: false });
  console.log('Saved mobile_booking_men.png');

  // Click on "Peluquería (Mujeres)" button
  const womenBtn = page.locator('button:has-text("Peluquería (Mujeres)")');
  if (await womenBtn.count() > 0) {
    await womenBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'C:/Users/jeloz/.gemini/antigravity/brain/112f3e2b-ee25-476a-8314-5639320b80b8/mobile_booking_women.png', fullPage: false });
    console.log('Saved mobile_booking_women.png');

    // Scroll down to see women services
    await page.evaluate(() => window.scrollBy(0, 450));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/jeloz/.gemini/antigravity/brain/112f3e2b-ee25-476a-8314-5639320b80b8/mobile_booking_women_services.png', fullPage: false });
    console.log('Saved mobile_booking_women_services.png');
  } else {
    console.log('Women button not found!');
  }

  await browser.close();
})();
