import puppeteer, { Browser, Page } from "puppeteer";

class BrowserPool {
  private static instance: BrowserPool;
  private browser: Browser | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  async initialize(): Promise<void> {
    if (this.browser || this.isInitializing) {
      return this.initPromise || Promise.resolve();
    }

    this.isInitializing = true;
    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log("Initializing browser pool...");
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-extensions",
          "--disable-default-apps",
          "--disable-background-networking",
          "--disable-sync",
          "--metrics-recording-only",
          "--no-default-browser-check",
          "--mute-audio",
          "--disable-web-security",
        ],
      });
      await setTimeout(() => {}, 1000); // Wait for a second to ensure browser is ready
      console.log("Browser pool initialized");
    } catch (error) {
      console.error("Failed to initialize browser pool:", error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async getPage(): Promise<Page> {
    await this.initialize();

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const page = await this.browser.newPage();

    // Optimize page for fast PDF generation
    await page.setViewport({ width: 1000, height: 700 });

    // Disable loading of unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (
        ["image", "media", "font", "other", "websocket"].includes(resourceType)
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Disable JavaScript execution for faster rendering (static content only)
    await page.setJavaScriptEnabled(true);

    return page;
  }

  async releasePage(page: Page): Promise<void> {
    try {
      // Add a delay to pause the browser before closing the page
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5-second delay
      // await page.close();
    } catch (error) {
      console.error("Error closing page:", error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitializing = false;
      this.initPromise = null;
    }
  }
}

export const browserPool = BrowserPool.getInstance();
