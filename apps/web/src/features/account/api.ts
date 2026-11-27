/**
 * Deleting your own account (photo privacy step 3) through the API
 * (DELETE /v1/me), which removes your photo files and then the account with
 * everything linked to it. Only available when the website talks to the API
 * (VITE_API_URL), so canDeleteAccount() decides whether Settings shows the button
 * and what the privacy page says. Used by ProfileSettingsDialog and LegalPages.
 */
import { getApi } from '@/lib/apiClient'

export type DeleteResult = { ok: true } | { ok: false; message: string }

/** Whether this website can delete accounts itself (it needs the API). */
export const canDeleteAccount = () => getApi() !== null

export async function deleteMyAccount(): Promise<DeleteResult> {
  const api = getApi()
  if (!api) return { ok: false, message: 'Deleting your account isn’t available here yet. Contact the team and we’ll remove it.' }
  try {
    await (await api).deleteMyAccount()
    return { ok: true }
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? Number((error as { status: unknown }).status) : 0
    const message = !status
      ? 'We couldn’t reach Breadcrumb. Check your connection and try again.'
      : status === 401
        ? 'Log in again, then try once more.'
        : status === 503 && error instanceof Error
          ? error.message
          : 'Something went wrong, and your account is still here. Please try again.'
    return { ok: false, message }
  }
}
