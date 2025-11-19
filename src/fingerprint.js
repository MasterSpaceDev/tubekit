import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise = null

function getFingerprintPromise() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }
  return fpPromise
}

export async function getDeviceInfo() {
  try {
    const fp = await getFingerprintPromise()
    const result = await fp.get()
    const fingerprint = result.visitorId
    
    const screenResolution = `${window.screen.width}x${window.screen.height}`
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    return {
      deviceFingerprint: fingerprint,
      screenResolution,
      timezone
    }
  } catch (error) {
    const screenResolution = `${window.screen.width}x${window.screen.height}`
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    return {
      deviceFingerprint: 'unknown',
      screenResolution,
      timezone
    }
  }
}

