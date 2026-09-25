import type { ImgHTMLAttributes } from 'react';
import { useTheme } from '@/lib/theme';

export function BrandLogo(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const { theme } = useTheme();
  const { style, ...rest } = props;
  return (
    <img
      {...rest}
      src="/vow-logo-source.webp"
      alt={props.alt || 'VOW'}
      style={{ ...style, filter: theme === 'dark' ? 'invert(1)' : undefined }}
    />
  );
}
