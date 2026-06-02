/**
 * pdfService.ts
 * Generates a PDF from an HTML string using puppeteer-core.
 * On Fly.io Alpine, uses system Chromium installed via apk.
 */

import puppeteerCore from "puppeteer-core";

let _executablePath: string | null = null;

async function getExecutablePath(): Promise<string> {
  if (_executablePath) return _executablePath;

  const systemChromium = process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser";
  const fs = await import("fs");
  if (fs.existsSync(systemChromium)) {
    _executablePath = systemChromium;
    return _executablePath;
  }

  // Local dev fallback
  try {
    const chromium = await import("@sparticuz/chromium");
    _executablePath = await chromium.default.executablePath();
    return _executablePath!;
  } catch {
    throw new Error("No Chromium executable found.");
  }
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const executablePath = await getExecutablePath();
  console.log("[pdfService] launching Chromium at:", executablePath);

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
      "--disable-extensions",
      "--disable-web-security",
      "--run-all-compositor-stages-before-draw",
    ],
  });

  console.log("[pdfService] browser launched");

  try {
    const page = await browser.newPage();
    console.log("[pdfService] new page created");

    // Inject CSS to hide toolbar before setting content
    const htmlWithHiddenToolbar = html.replace(
      "</head>",
      `<style>.report-toolbar{display:none!important;}body{padding-top:0!important;}</style></head>`
    );

    await page.setContent(htmlWithHiddenToolbar, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    console.log("[pdfService] content set");

    // Wait for layout to fully settle
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("[pdfService] settled, generating PDF");

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "18mm", right: "18mm" },
      displayHeaderFooter: false,
    });

    console.log("[pdfService] PDF generated, bytes:", pdf.length);
    return Buffer.from(pdf);
  } finally {
    await browser.close();
    console.log("[pdfService] browser closed");
  }
}
