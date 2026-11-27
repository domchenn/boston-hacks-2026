/**
 * The caller's account: self-serve deletion (photo privacy step 3), backed by
 * caller-scoped Supabase queries and Storage.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { AccountController } from './account.controller.js'
import { AccountService } from './account.service.js'

@Module({ imports: [SupabaseModule], controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}
