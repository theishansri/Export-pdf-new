import crypto from "crypto";
import { LRUCache } from "lru-cache";

interface CachedPDF {
  buffer: Buffer;
  contentType: string;
  filename: string;
  timestamp: number;
}

class PDFCache {
  private static instance: PDFCache;
  private cache: LRUCache<string, CachedPDF>;

  private constructor() {
    // Configure cache with 50MB max size and 3 seconds TTL
    this.cache = new LRUCache<string, CachedPDF>({
      max: 20, // Maximum 20 PDFs in cache
      ttl: 1000 * 60 * 5, // 3 seconds TTL
      maxSize: 50 * 1024 * 1024, // 50MB max cache size
      sizeCalculation: (value) => value.buffer.length,
      dispose: (value) => {
        console.log(`Evicting cached PDF: ${value.filename}`);
      },
    });
  }

  static getInstance(): PDFCache {
    if (!PDFCache.instance) {
      PDFCache.instance = new PDFCache();
    }
    return PDFCache.instance;
  }

  generateKey(html: string, css: string, options: any): string {
    const content = JSON.stringify({ html, css, options });
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 16);
  }

  get(key: string): CachedPDF | undefined {
    const cached = this.cache.get(key);
    if (cached) {
      console.log(`Cache hit for key: ${key}`);
      return cached;
    }
    console.log(`Cache miss for key: ${key}`);
    return undefined;
  }

  set(key: string, pdf: CachedPDF): void {
    this.cache.set(key, pdf);
    console.log(
      `Cached PDF with key: ${key}, size: ${pdf.buffer.length} bytes`,
    );
  }

  clear(): void {
    this.cache.clear();
    console.log("PDF cache cleared");
  }

  getStats(): { size: number; maxSize: number; itemCount: number } {
    return {
      size: this.cache.calculatedSize || 0,
      maxSize: this.cache.maxSize || 0,
      itemCount: this.cache.size,
    };
  }
}

export const pdfCache = PDFCache.getInstance();
