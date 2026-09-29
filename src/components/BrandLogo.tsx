import type { ImgHTMLAttributes } from 'react';

/**
 * Canonical VOW wordmark. This is the same source artwork used for the
 * branded splash/auth surfaces; do not substitute generated or filtered marks.
 */
export function BrandLogo(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const { style, ...rest } = props;
  return (
    <img
      {...rest}
      src="/vow-logo.svg"
      alt={props.alt || 'VOW'}
      draggable={false}
      decoding="async"
      style={{ ...style }}
    />
  );
}
