/**
 * Supabase in the app, used only for signing in (everything else goes through the
 * API). The session (access and refresh tokens) is kept encrypted, as Supabase's Expo
 * guide recommends: a random AES-256 key lives in the iPhone Keychain / Android
 * Keystore (expo-secure-store), and the encrypted session in AsyncStorage, because the
 * secure store isn't meant for large values. Null when the Supabase settings are missing.
 */
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import aesjs from 'aes-js'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { config } from './config'

/** Session storage for supabase-js: values encrypted with a per-key secret held in the secure store. */
class EncryptedSessionStorage {
  private async encrypt(key: string, value: string) {
    const secret = Crypto.getRandomBytes(32)
    const cipher = new aesjs.ModeOfOperation.ctr(secret, new aesjs.Counter(1))
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value))
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(secret))
    return aesjs.utils.hex.fromBytes(encrypted)
  }

  private async decrypt(key: string, value: string) {
    const secretHex = await SecureStore.getItemAsync(key)
    if (!secretHex) return null
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(secretHex), new aesjs.Counter(1))
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)))
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key)
    return encrypted ? this.decrypt(key, encrypted) : null
  }

  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, await this.encrypt(key, value))
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(key)
  }
}

export const supabase: SupabaseClient | null =
  config.supabaseUrl && config.supabasePublishableKey
    ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          storage: new EncryptedSessionStorage(),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null
