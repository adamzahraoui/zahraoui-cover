import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'light'
const variants: Record<Variant, string> = {
  primary: 'action-primary',
  secondary: 'action-secondary',
  light: 'action-light',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return <button type={type} className={`action ${variants[variant]} ${className}`} {...props} />
}

type ActionLinkProps = {
  to: string
  children: ReactNode
  variant?: Variant
  className?: string
}

export function ActionLink({ to, children, variant = 'primary', className = '' }: ActionLinkProps) {
  const classes = `action ${variants[variant]} ${className}`
  return to.startsWith('tel:')
    ? <a href={to} className={classes}>{children}</a>
    : <Link to={to} className={classes}>{children}</Link>
}
