import { memo, useId, type InputHTMLAttributes } from 'react';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Formatted current value shown beside the label (e.g. "1.0×"). */
  display: string;
}

/** Labeled range input with an accessible association and live value readout. */
export const Slider = memo(function Slider({ label, display, ...rest }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex justify-between text-sm text-muted">
        <span>{label}</span>
        <output className="text-fg">{display}</output>
      </label>
      <input
        id={id}
        type="range"
        className="w-full accent-accent"
        aria-valuetext={display}
        {...rest}
      />
    </div>
  );
});
