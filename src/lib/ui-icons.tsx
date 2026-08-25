import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;
function Icon({ children, viewBox = '0 0 24 24', ...props }: Props & { children: React.ReactNode; viewBox?: string }) {
  return <svg viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>{children}</svg>;
}
const path = (d:string) => <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>;
export const Lock = (p:Props) => <Icon {...p}>{path('M6 10V7.5A6 6 0 0 1 18 7.5V10M5 10H19V20H5V10ZM12 14V16')}</Icon>;
export const Plus = (p:Props) => <Icon {...p}>{path('M12 5V19M5 12H19')}</Icon>;
export const X = (p:Props) => <Icon {...p}>{path('M6 6L18 18M18 6L6 18')}</Icon>;
export const Check = (p:Props) => <Icon {...p}>{path('M5 12.5L9.5 17L19 7')}</Icon>;
export const Circle = (p:Props) => <Icon {...p}>{<circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>}</Icon>;
export const CheckCircle2 = (p:Props) => <Icon {...p}>{<><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>{path('M8 12L11 15L16.5 9.5')}</>}</Icon>;
export const SkipForward = (p:Props) => <Icon {...p}>{<><path d="M6 6L14 12L6 18V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>{path('M18 6V18')}</>}</Icon>;
export const Move = (p:Props) => <Icon {...p}>{<>{path('M8 5L5 8L8 11M5 8H16M16 13L19 16L16 19M19 16H8')}</>}</Icon>;
export const Flag = (p:Props) => <Icon {...p}>{path('M6 20V5M6 5C10 2.5 14 7.5 19 5V14C14 16.5 10 11.5 6 14')}</Icon>;
export const Pause = (p:Props) => <Icon {...p}>{path('M8 6V18M16 6V18')}</Icon>;
export const AlertTriangle = (p:Props) => <Icon {...p}>{<><path d="M12 4L21 20H3L12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>{path('M12 9V13M12 16H12.01')}</>}</Icon>;
export const ChevronDown = (p:Props) => <Icon {...p}>{path('M6 9L12 15L18 9')}</Icon>;
export const ChevronUp = (p:Props) => <Icon {...p}>{path('M6 15L12 9L18 15')}</Icon>;
export const ArrowLeft = (p:Props) => <Icon {...p}>{path('M19 12H5M11 6L5 12L11 18')}</Icon>;
export const Calendar = (p:Props) => <Icon {...p}>{<><rect x="4" y="5.5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>{path('M8 3.5V7.5M16 3.5V7.5M4 9.5H20')}</>}</Icon>;
export const Clock = (p:Props) => <Icon {...p}>{<><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/>{path('M12 8V12L15 14')}</>}</Icon>;
