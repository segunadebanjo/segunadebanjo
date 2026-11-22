import { useMemo } from 'react';
import { renderFrontCover, defaultCoverConfig } from '@shared/cover.js';
import { TRIM_SIZES } from '@shared/constants.js';

/** Renders the shared cover design at a fixed design width and scales it to `width`. */
export default function CoverThumb({ book, brand, config, width = 140, className = '' }) {
  const trim = book?.trim_size || '6x9';
  const ts = TRIM_SIZES[trim] || TRIM_SIZES['6x9'];
  const cfg = config || { ...defaultCoverConfig(book, brand), ...(book?.cover_config_json || {}) };
  const html = useMemo(() => renderFrontCover(cfg, { widthPx: 600, trim }), [JSON.stringify(cfg), trim]);
  const scale = width / 600;
  return (
    <div className={`relative overflow-hidden rounded-sm shadow-md ${className}`} style={{ width, height: (width * ts.height) / ts.width }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
