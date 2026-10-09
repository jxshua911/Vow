type Props = { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean };

export function MonochromeSwitch({ checked, onChange, label, disabled = false }: Props) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    onClick={() => onChange(!checked)} className={`vow-switch${checked ? ' vow-switch-checked' : ''}`}>
    <span className="vow-switch-thumb" aria-hidden="true" />
  </button>;
}
