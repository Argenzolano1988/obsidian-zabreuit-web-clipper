import { verifyLicenseToken, DEFAULT_ED25519_PUBLIC_KEY_PEM } from '@zabreuit/core/browser';
import { requestUrl } from 'obsidian';

export interface LicenseValidationResponse {
  isValid: boolean;
  isPro: boolean;
  expiryDate?: number;
  sltToken?: string;
  error?: string;
}

export class LicenseService {
  private publicKeyPem: string;

  constructor(customPublicKeyPem?: string) {
    this.publicKeyPem = customPublicKeyPem || DEFAULT_ED25519_PUBLIC_KEY_PEM;
  }

  /**
   * Verifies an offline SLT token or activates an online Gumroad/Polar license key.
   */
  async validateOrActivate(keyOrToken: string): Promise<LicenseValidationResponse> {
    const trimmed = keyOrToken.trim();
    if (!trimmed) {
      return { isValid: false, isPro: false, error: 'Empty license key' };
    }

    // 1. Direct offline verification if key format is SLT ("PAYLOAD.SIGNATURE")
    if (trimmed.includes('.')) {
      return this.verifyOfflineToken(trimmed);
    }

    // 2. Online activation via Cloudflare Worker Free Tier
    try {
      const response = await requestUrl({
        url: 'https://license.zabreuit.com/v1/license/activate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Obsidian-Zabreuit-Clipper/1.0',
        },
        body: JSON.stringify({ licenseKey: trimmed }),
        throw: false,
      });

      if (response.status >= 200 && response.status < 300) {
        const data = response.json;
        if (data && data.valid && data.sltToken) {
          const offlineCheck = await this.verifyOfflineToken(data.sltToken);
          if (offlineCheck.isValid) {
            return offlineCheck;
          }
        }
        return {
          isValid: false,
          isPro: false,
          error: data?.error || `Activation rejected by server (HTTP ${response.status})`,
        };
      }

      return {
        isValid: false,
        isPro: false,
        error: `Activation server error: HTTP ${response.status}`,
      };
    } catch (err: unknown) {
      // In offline scenario or network unreachable
      return {
        isValid: false,
        isPro: false,
        error: err instanceof Error ? err.message : 'Network error during license activation',
      };
    }
  }

  /**
   * Verifies an Ed25519 Signed License Token (SLT) 100% offline via Web Crypto.
   */
  async verifyOfflineToken(sltToken: string): Promise<LicenseValidationResponse> {
    try {
      const res = await verifyLicenseToken(sltToken, this.publicKeyPem);
      if (res.valid && res.payload) {
        const isPro = res.payload.tier === 'PRO' || res.payload.tier === 'ENTERPRISE';
        return {
          isValid: true,
          isPro,
          expiryDate: res.payload.exp,
          sltToken,
        };
      }
      return {
        isValid: false,
        isPro: false,
        error: res.error || 'Invalid Ed25519 signature or expired token',
      };
    } catch (err: unknown) {
      return {
        isValid: false,
        isPro: false,
        error: err instanceof Error ? err.message : 'Failed to verify token',
      };
    }
  }
}
