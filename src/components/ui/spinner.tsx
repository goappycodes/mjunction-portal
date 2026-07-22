import { cn } from '@/lib/utils';

/**
 * Snake spinner — an arc chasing its tail. Uses `currentColor` so it inherits
 * the button/text colour. Size via width/height utility classes (default 1em).
 */
export function Spinner({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('snake-spinner', className)}
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 8)),
      }}
    />
  );
}
