import type { ImgHTMLAttributes } from 'react';
import { useTheme } from '@/lib/theme';

export function BrandLogo(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const { theme } = useTheme();
  return <img {...props} src={theme === 'dark' ? './vow-logo-white.svg' : './vow-logo.svg'} alt={props.alt || 'VOW'} />;
}
