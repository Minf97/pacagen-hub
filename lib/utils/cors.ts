/**
 * CORS utilities for API routes
 * Handles cross-origin requests from Hydrogen storefronts
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Get CORS headers with a specific allowed origin
 * Use this for more restricted CORS policies
 */
export function getCorsHeaders(allowedOrigin: string = '*') {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Get CORS headers with multiple allowed origins
 * Validates the request origin and returns appropriate headers
 */
export function getCorsHeadersForOrigins(
  requestOrigin: string | null,
  allowedOrigins: string[]
): Record<string, string> {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || '*';

  return getCorsHeaders(origin);
}

/**
 * Common allowed origins for Pacagen Hub
 * Add your Hydrogen storefront domains here
 */
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourstorefront.myshopify.com',
  // Add production domains here
];
