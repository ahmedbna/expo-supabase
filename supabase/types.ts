// supabase/types.ts
//
// GENERATED FILE — do not edit by hand.
// Regenerate with: `npm run db:types`
//
// This is a hand-written stub matching the migrations in this repo.
// Once you run `npm run db:types` against your local Supabase instance,
// this file will be overwritten with the full generated output
// including every column, function, enum, and relationship.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          name: string | null;
          bio: string | null;
          gender: string | null;
          birthday: number | null;
          image: string | null;
          email_verification_time: number | null;
          phone_verification_time: number | null;
          is_anonymous: boolean;
          github_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          name?: string | null;
          bio?: string | null;
          gender?: string | null;
          birthday?: number | null;
          image?: string | null;
          email_verification_time?: number | null;
          phone_verification_time?: number | null;
          is_anonymous?: boolean;
          github_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          name?: string | null;
          bio?: string | null;
          gender?: string | null;
          birthday?: number | null;
          image?: string | null;
          email_verification_time?: number | null;
          phone_verification_time?: number | null;
          is_anonymous?: boolean;
          github_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'users_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
