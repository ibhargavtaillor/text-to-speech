import { memo, useCallback } from 'react';
import { Slider } from '@/components/atoms/Slider';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

/** Adapts the numeric Slider atom to a typed value + formatter. */
export const RangeField = memo(function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: RangeFieldProps) {
  const handle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)),
    [onChange],
  );

  return (
    <Slider
      label={label}
      display={format(value)}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={handle}
    />
  );
});
