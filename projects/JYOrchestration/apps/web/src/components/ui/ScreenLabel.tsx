export type ScreenLabelProps = {
  label: string;
  visible: boolean;
};

export function ScreenLabel({ label, visible }: ScreenLabelProps) {
  if (!visible) return null;

  return <span className="ui-screen-label">{label}</span>;
}
