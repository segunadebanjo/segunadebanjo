import type { Platform } from '@prisma/client';
import { config, credentials } from '../../config.js';
import { PLATFORMS } from '../../types.js';
import { GoogleAdsAdapter } from './google.js';
import { LinkedInAdapter } from './linkedin.js';
import { MetaAdapter } from './meta.js';
import { SandboxAdapter } from './sandbox.js';
import type { AdPlatformAdapter } from './types.js';

export * from './types.js';

function liveAvailable(platform: Platform): boolean {
  if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') return credentials.meta;
  if (platform === 'GOOGLE_SEARCH' || platform === 'GOOGLE_DISPLAY') return credentials.google;
  return credentials.linkedin;
}

/** Factory: live adapter when SANDBOX_MODE=false and credentials exist, sandbox otherwise. */
export function getAdapter(platform: Platform): AdPlatformAdapter {
  if (config.SANDBOX_MODE || !liveAvailable(platform)) return new SandboxAdapter(platform);
  switch (platform) {
    case 'FACEBOOK':
    case 'INSTAGRAM':
      return new MetaAdapter(platform);
    case 'GOOGLE_SEARCH':
    case 'GOOGLE_DISPLAY':
      return new GoogleAdsAdapter(platform);
    case 'LINKEDIN':
      return new LinkedInAdapter();
  }
}

export function platformStatus() {
  return PLATFORMS.map((p) => ({
    platform: p,
    mode: getAdapter(p).mode,
    credentialsConfigured: liveAvailable(p),
    reason: config.SANDBOX_MODE ? 'SANDBOX_MODE=true' : liveAvailable(p) ? 'live credentials configured' : 'credentials missing → sandbox fallback',
  }));
}
