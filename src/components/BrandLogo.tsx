import type { ImgHTMLAttributes } from 'react';
export function BrandLogo(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  return <picture><source media="(prefers-color-scheme: dark)" srcSet="/vow-logo-white.svg" /><img {...props} src="/vow-logo.svg" alt={props.alt || 'VOW'} /></picture>;
}
