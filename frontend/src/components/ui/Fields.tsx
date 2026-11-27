import { useId } from 'react'
import type {
  InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes,
} from 'react'

type FieldText = { label: string; error?: string; hint?: string }
export type SelectOption = { value: string; label: string; disabled?: boolean }

function Field({ id, label, required, error, hint, children }: FieldText & {
  id: string; required?: boolean; children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}{required && ' *'}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  )
}

function fieldAttributes(id: string, error?: string, hint?: string) {
  return {
    id,
    className: 'control',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
  } as const
}

export function Input({ label, error, hint, ...props }: FieldText & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  return (
    <Field id={id} label={label} required={props.required} error={error} hint={hint}>
      <input {...props} {...fieldAttributes(id, error, hint)} />
    </Field>
  )
}

export function Select({ label, error, hint, options, placeholder, ...props }: FieldText
  & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[]; placeholder?: string }) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  return (
    <Field id={id} label={label} required={props.required} error={error} hint={hint}>
      <div className="relative">
        <select {...props} {...fieldAttributes(id, error, hint)} className="control appearance-none pr-9">
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 my-auto size-2 rotate-45 border-r-2 border-b-2 border-muted" aria-hidden />
      </div>
    </Field>
  )
}

export function Textarea({ label, error, hint, ...props }: FieldText & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  return (
    <Field id={id} label={label} required={props.required} error={error} hint={hint}>
      <textarea rows={4} {...props} {...fieldAttributes(id, error, hint)} />
    </Field>
  )
}
