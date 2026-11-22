import QRCode from 'qrcode';
import { buildCtaUrl } from '../../shared/constants.js';

export async function makeQr(text, { dark = '#0F2942' } = {}) {
  return QRCode.toDataURL(text || ' ', { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark, light: '#FFFFFFFF' } });
}

export async function qrForCta(cta, { bookId, dark } = {}) {
  const url = buildCtaUrl(cta, { bookId, source: 'qr' });
  return { url, qr: await makeQr(url, { dark }) };
}
