/**
 * The Breadcrumb API client for the app: the same typed client as the website
 * (@breadcrumb/contracts), pointed at EXPO_PUBLIC_API_URL. Sign-in (M18b) will add the
 * signed-in user's access token. Null when the API address isn't configured.
 */
import { createApiClient, type ApiClient } from '@breadcrumb/contracts'
import { config } from './config'

export const api: ApiClient | null = config.apiUrl ? createApiClient({ baseUrl: config.apiUrl }) : null
