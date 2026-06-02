/**
 * pdfService.ts
 * Generates a PDF from an HTML string using puppeteer-core + @sparticuz/chromium.
 * On Alpine Linux (Fly.io), uses the system Chromium installed via apk.
 */

import puppeteerCore from "puppeteer-core";

let _executablePath: string | null = null;

async function getExecutablePath(): Promise<string> {
  if (_executablePath) return _executablePath;

  // On Fly.io Alpine, use system Chromium installed via apk
  const systemChromium = process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser";

  // In local dev, fall back to @sparticuz/chromium
  const fs = await import("fs");
  if (fs.existsSync(systemChromium)) {
    _executablePath = systemChromium;
    return _executablePath;
  }

  // Local dev fallback — use @sparticuz/chromium
  try {
    const chromium = await import("@sparticuz/chromium");
    _executablePath = await chromium.default.executablePath();
    return _executablePath!;
  } catch {
    throw new Error("No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install @sparticuz/chromium.");
  }
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const executablePath = await getExecutablePath();

  const browser = await puppeteerCore.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for fonts/images to load
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for page to fully settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Hide the toolbar before printing
    await page.addStyleTag({
      content: `.report-toolbar { display: none !important; } body { padding-top: 0 !important; }`,
    });

    // Small additional settle time after style injection
    await new Promise(resolve => setTimeout(resolve, 200));

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "18mm", right: "18mm" },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
