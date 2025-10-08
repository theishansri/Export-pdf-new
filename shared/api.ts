/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  rows: Object[];
}
export interface PDFGenerationRequest {
  html: string;
  css: string;
  title?: string;
  format?: "A4" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  compress?: boolean; // Enable compression optimizations
  quality?: "high" | "medium" | "low"; // Quality vs size trade-off
  cssOnly?: boolean; // Enable debug mode for verbose logging
}

/**
 * Response type for PDF generation API
 */
export interface PDFGenerationResponse {
  success: boolean;
  message?: string;
  error?: string;
}
