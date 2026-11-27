import { z } from 'zod'
import { tokenFormat } from '../../utils/crypto.js'

export const emailField = z.string().trim().toLowerCase().max(254).email()
export const displayNameField = z.string().trim().min(2).max(120)
const existingPassword = z.string().min(1).max(128)
const newPassword = z.string().min(15).max(128)

export const loginInput = z.strictObject({ email: emailField, password: existingPassword })
export const forgotInput = z.strictObject({ email: emailField })
export const resetInput = z.strictObject({ token: z.string().regex(tokenFormat), password: newPassword })
export const changePasswordInput = z.strictObject({ currentPassword: existingPassword, newPassword })
