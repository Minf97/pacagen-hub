/**
 * User-Agent Parsing Utilities
 * Used for device detection and analytics segmentation
 */

/**
 * Device type classification
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

/**
 * Detect device type from User-Agent string
 *
 * @param userAgent - User-Agent header value
 * @returns Device type classification
 *
 * @example
 * getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)') // 'mobile'
 * getDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)') // 'desktop'
 */
export function getDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return 'unknown'

  const ua = userAgent.toLowerCase()

  // Check for tablet first (more specific)
  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(ua)) {
    return 'tablet'
  }

  // Check for mobile devices
  if (/(mobile|iphone|ipod|android|blackberry|windows phone|webos)/.test(ua)) {
    return 'mobile'
  }

  // Check for desktop indicators
  if (/(windows|macintosh|linux|x11)/.test(ua)) {
    return 'desktop'
  }

  // Default to unknown for edge cases
  return 'unknown'
}

/**
 * Extract browser name from User-Agent
 *
 * @param userAgent - User-Agent header value
 * @returns Browser name or null
 */
export function getBrowserName(userAgent: string | null): string | null {
  if (!userAgent) return null

  const ua = userAgent.toLowerCase()

  if (ua.includes('chrome')) return 'Chrome'
  if (ua.includes('safari')) return 'Safari'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('edge')) return 'Edge'
  if (ua.includes('opera')) return 'Opera'

  return null
}

/**
 * Extract OS name from User-Agent
 *
 * @param userAgent - User-Agent header value
 * @returns OS name or null
 */
export function getOSName(userAgent: string | null): string | null {
  if (!userAgent) return null

  const ua = userAgent.toLowerCase()

  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac os x')) return 'macOS'
  if (ua.includes('linux')) return 'Linux'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS'

  return null
}
