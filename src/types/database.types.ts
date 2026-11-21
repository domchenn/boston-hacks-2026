/**
 * PROVISIONAL database types, hand-written to match
 * supabase/migrations/001_initial_schema.sql.
 *
 * These were NOT generated from a live database. Once the migration is applied, replace
 * this file with generated types:
 *   npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.ts
 * (Relationships are left empty here, so typed nested selects are less precise until then.)
 */

export type SidequestStatus = 'draft' | 'published' | 'archived'
export type ParticipantStatus = 'going' | 'interested'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          university: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          university?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          university?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sidequests: {
        Row: {
          id: string
          creator_id: string
          title: string
          description: string | null
          cover_image_url: string | null
          category: string | null
          estimated_cost: number | null
          estimated_duration_minutes: number | null
          neighborhood: string | null
          scheduled_at: string | null
          status: SidequestStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          title: string
          description?: string | null
          cover_image_url?: string | null
          category?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          neighborhood?: string | null
          scheduled_at?: string | null
          status?: SidequestStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          title?: string
          description?: string | null
          cover_image_url?: string | null
          category?: string | null
          estimated_cost?: number | null
          estimated_duration_minutes?: number | null
          neighborhood?: string | null
          scheduled_at?: string | null
          status?: SidequestStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sidequest_stops: {
        Row: {
          id: string
          sidequest_id: string
          place_name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          stop_order: number
          description: string | null
          estimated_cost: number | null
          created_at: string
        }
        Insert: {
          id?: string
          sidequest_id: string
          place_name: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          stop_order: number
          description?: string | null
          estimated_cost?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          sidequest_id?: string
          place_name?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          stop_order?: number
          description?: string | null
          estimated_cost?: number | null
          created_at?: string
        }
        Relationships: []
      }
      saved_sidequests: {
        Row: {
          user_id: string
          sidequest_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          sidequest_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          sidequest_id?: string
          created_at?: string
        }
        Relationships: []
      }
      sidequest_participants: {
        Row: {
          id: string
          user_id: string
          sidequest_id: string
          status: ParticipantStatus
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sidequest_id: string
          status?: ParticipantStatus
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sidequest_id?: string
          status?: ParticipantStatus
          joined_at?: string
        }
        Relationships: []
      }
      completed_sidequests: {
        Row: {
          user_id: string
          sidequest_id: string
          completed_at: string
        }
        Insert: {
          user_id: string
          sidequest_id: string
          completed_at?: string
        }
        Update: {
          user_id?: string
          sidequest_id?: string
          completed_at?: string
        }
        Relationships: []
      }
      sidequest_reviews: {
        Row: {
          id: string
          user_id: string
          sidequest_id: string
          fun_rating: number
          value_rating: number
          travel_rating: number
          review_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sidequest_id: string
          fun_rating: number
          value_rating: number
          travel_rating: number
          review_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sidequest_id?: string
          fun_rating?: number
          value_rating?: number
          travel_rating?: number
          review_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          id: string
          name: string
          university: string | null
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          university?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          university?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          community_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          community_id?: string
          user_id?: string
          joined_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicTables = Database['public']['Tables']
/** Row type helpers, e.g. `Tables<'sidequests'>`. */
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']
