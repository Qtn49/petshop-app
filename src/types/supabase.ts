export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          pin_hash: string;
          email: string | null;
          name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pin_hash: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pin_hash?: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      supplier_links: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: string;
          file_size: number | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_path: string;
          file_type: string;
          file_size?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_path?: string;
          file_type?: string;
          file_size?: number | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          product_name: string;
          quantity: number;
          price: number | null;
          square_item_id: string | null;
          square_catalog_item_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          product_name: string;
          quantity?: number;
          price?: number | null;
          square_item_id?: string | null;
          square_catalog_item_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          product_name?: string;
          quantity?: number;
          price?: number | null;
          square_item_id?: string | null;
          square_catalog_item_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          completed: boolean;
          due_date: string | null;
          priority: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          completed?: boolean;
          due_date?: string | null;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          completed?: boolean;
          due_date?: string | null;
          priority?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tanks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          fish_species: string | null;
          fish_count: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          fish_species?: string | null;
          fish_count?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          fish_species?: string | null;
          fish_count?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tank_events: {
        Row: {
          id: string;
          tank_id: string;
          event_date: string;
          deaths: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tank_id: string;
          event_date: string;
          deaths?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tank_id?: string;
          event_date?: string;
          deaths?: number;
          notes?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string | null;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message?: string | null;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string | null;
          type?: string;
          read?: boolean;
          created_at?: string;
        };
      };
    };
  };
}
