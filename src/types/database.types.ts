/**
 * Database types for migrations 001 + 002.
 *
 * Generated from the migrations applied to a scratch Postgres database (same
 * shape as `supabase gen types typescript`), NOT from the live Supabase project.
 * Once the migrations are applied to the shared project, regenerate:
 *   npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      checklist_completions: {
        Row: {
          user_id: string
          checklist_item_id: string
          completed_at: string
          photo_url: string | null
        }
        Insert: {
          user_id: string
          checklist_item_id: string
          completed_at?: string
          photo_url?: string | null
        }
        Update: {
          user_id?: string
          checklist_item_id?: string
          completed_at?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_completions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      checklist_items: {
        Row: {
          id: string
          sidequest_id: string
          stop_id: string | null
          label: string
          item_type: string
          item_order: number
          is_checkpoint: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sidequest_id: string
          stop_id?: string | null
          label: string
          item_type?: string
          item_order?: number
          is_checkpoint?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sidequest_id?: string
          stop_id?: string | null
          label?: string
          item_type?: string
          item_order?: number
          is_checkpoint?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_sidequest_id_fkey"
            columns: ["sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_stop_fk"
            columns: ["stop_id", "sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequest_stops"
            referencedColumns: ["id", "sidequest_id"]
          }
        ]
      }
      communities: {
        Row: {
          id: string
          name: string
          university: string | null
          description: string | null
          created_by: string | null
          created_at: string
          slug: string | null
        }
        Insert: {
          id?: string
          name: string
          university?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
          slug?: string | null
        }
        Update: {
          id?: string
          name?: string
          university?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      creator_ratings: {
        Row: {
          rater_id: string
          creator_id: string
          rating: number
          created_at: string
        }
        Insert: {
          rater_id: string
          creator_id: string
          rating: number
          created_at?: string
        }
        Update: {
          rater_id?: string
          creator_id?: string
          rating?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_ratings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      experiences: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          neighborhood: string | null
          address: string | null
          latitude: number
          longitude: number
          estimated_cost: number | null
          nearest_station: string | null
          open_late: boolean
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          neighborhood?: string | null
          address?: string | null
          latitude: number
          longitude: number
          estimated_cost?: number | null
          nearest_station?: string | null
          open_late?: boolean
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          neighborhood?: string | null
          address?: string | null
          latitude?: number
          longitude?: number
          estimated_cost?: number | null
          nearest_station?: string | null
          open_late?: boolean
          image_url?: string | null
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
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          university: string | null
          created_at: string
          community_id: string | null
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          university?: string | null
          created_at?: string
          community_id?: string | null
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          university?: string | null
          created_at?: string
          community_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      quest_photos: {
        Row: {
          id: string
          user_id: string
          sidequest_id: string
          photo_url: string
          caption: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sidequest_id: string
          photo_url: string
          caption?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sidequest_id?: string
          photo_url?: string
          caption?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_photos_sidequest_id_fkey"
            columns: ["sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      sidequest_ratings: {
        Row: {
          id: string
          user_id: string
          sidequest_id: string
          price_rating: number
          time_rating: number
          enjoyment_rating: number
          memorability_rating: number
          review_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sidequest_id: string
          price_rating: number
          time_rating: number
          enjoyment_rating: number
          memorability_rating: number
          review_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sidequest_id?: string
          price_rating?: number
          time_rating?: number
          enjoyment_rating?: number
          memorability_rating?: number
          review_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sidequest_ratings_sidequest_id_fkey"
            columns: ["sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sidequest_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
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
          experience_id: string | null
          planned_activity: string | null
          travel_mode_to_stop: string | null
          notes: string | null
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
          experience_id?: string | null
          planned_activity?: string | null
          travel_mode_to_stop?: string | null
          notes?: string | null
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
          experience_id?: string | null
          planned_activity?: string | null
          travel_mode_to_stop?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sidequest_stops_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sidequest_stops_sidequest_id_fkey"
            columns: ["sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequests"
            referencedColumns: ["id"]
          }
        ]
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
          status: string
          created_at: string
          updated_at: string
          community_id: string | null
          primary_line: string | null
          is_curated: boolean
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
          status?: string
          created_at?: string
          updated_at?: string
          community_id?: string | null
          primary_line?: string | null
          is_curated?: boolean
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
          status?: string
          created_at?: string
          updated_at?: string
          community_id?: string | null
          primary_line?: string | null
          is_curated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sidequests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sidequests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_sidequests: {
        Row: {
          user_id: string
          sidequest_id: string
          status: string
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          sidequest_id: string
          status: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          sidequest_id?: string
          status?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sidequests_sidequest_id_fkey"
            columns: ["sidequest_id"]
            isOneToOne: false
            referencedRelation: "sidequests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sidequests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      questgiver_ratings: {
        Row: {
          creator_id: string | null
          rating_count: number | null
          avg_overall: number | null
        }
        Relationships: []
      }
      sidequest_rating_stats: {
        Row: {
          sidequest_id: string | null
          rating_count: number | null
          avg_price: number | null
          avg_time: number | null
          avg_enjoyment: number | null
          avg_memorability: number | null
          avg_overall: number | null
        }
        Relationships: []
      }
    }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']

/** Row type of a table or view, e.g. `Tables<'sidequests'>`. */
export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']

// Allowed values enforced by CHECK constraints (Postgres reports these columns as plain text).
export type SidequestStatus = 'draft' | 'published' | 'archived'
export type UserSidequestStatus = 'saved' | 'signed_up' | 'in_progress' | 'completed' | 'aborted'
export type Category = 'food_drink' | 'outdoors' | 'arts_culture' | 'shopping' | 'attractions' | 'affordable'
export type TravelMode = 'walk' | 'bike' | 'bus' | 'train'
export type TransitLine = 'rl' | 'gl' | 'bl' | 'ol' | 'sl' | 'cr'
export type ChecklistItemType = 'see' | 'do'
