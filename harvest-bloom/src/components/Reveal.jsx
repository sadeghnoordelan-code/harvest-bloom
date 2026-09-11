import { useInView } from '../hooks/useInView.js'

/** Fades and lifts its children the first time they enter the viewport. */
export default function Reveal({
  as: Tag = 'div',
  className = '',
  delay = 0,
  children,
  ...rest
}) {
  const [ref, seen] = useInView()
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}${seen ? ' is-in' : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
