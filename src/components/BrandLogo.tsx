import type { ImgHTMLAttributes } from 'react';

/**
 * Canonical VOW brand mark.
 *
 * This asset is intentionally rendered without filters, colour transforms,
 * or alternate marks. The canonical logo must remain visually unchanged.
 */
export function BrandLogo(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const { style, ...rest } = props;
  return (
    <img
      {...rest}
      src="/vow-logo-source.webp"
      alt={props.alt || 'VOW'}
      draggable={false}
      decoding="async"
      style={{ ...style }}
    />
  );
}
