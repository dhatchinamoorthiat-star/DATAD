const PADDING = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

const BASE =
  'rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06),0_1px_3px_rgba(60,64,67,0.08)] dark:border-gray-800/80 dark:bg-gray-900 dark:shadow-none';

export default function Card({
  padding = 'md',
  hoverable = false,
  onClick,
  as: Tag = 'div',
  className = '',
  children,
}) {
  const interactive = hoverable || onClick;
  const cls = `${BASE} ${PADDING[padding]} ${
    interactive
      ? 'transition-all duration-200 ease-out cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(60,64,67,0.08),0_6px_16px_rgba(60,64,67,0.1)] dark:hover:-translate-y-0.5 dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
      : ''
  } ${className}`;

  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{children}</button>;
  }

  return <Tag className={cls}>{children}</Tag>;
}
