import { puppeteerClient } from '@/lib/scrapers/puppeteer-client';
import fs from 'fs';
import path from 'path';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

async function probe() {
  const url = 'https://www.bctnpy.org/verify/advocate';
  console.log(`Probing ${url}...`);

  try {
    const browser = await puppeteerClient.getBrowser();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Page loaded');

    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Search') || document.body.innerText.includes('Advocate'),
        { timeout: 15000 }
      );
      console.log('Hydrated');
      await new Promise((r) => setTimeout(r, 5000));
    } catch {
      console.warn('Hydration wait timeout');
    }

    const screenshotPath = path.join(process.cwd(), 'public', 'bctnpy-probe.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);

    const html = await page.content();
    const htmlPath = path.join(process.cwd(), 'public', 'bctnpy-probe.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`HTML saved: ${htmlPath}`);

    await page.close();
    process.exit(0);
  } catch (error: unknown) {
    console.error('Probe failed:', getErrorMessage(error));
    process.exit(1);
  }
}

void probe();
