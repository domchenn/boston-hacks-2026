/**
 * Provides SupabaseClients (caller-scoped Supabase access) to feature modules.
 */
import { Module } from '@nestjs/common'
import { SupabaseClients } from './supabase-clients.js'

@Module({ providers: [SupabaseClients], exports: [SupabaseClients] })
export class SupabaseModule {}
