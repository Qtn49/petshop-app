export type User = {
  id: string;
  pin_hash: string;
  email: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierLink = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  status: 'uploaded' | 'parsing' | 'parsed' | 'error';
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_name: string;
  quantity: number;
  price: number | null;
  square_item_id: string | null;
  square_catalog_item_id: string | null;
  status: 'pending' | 'matched' | 'unmatched' | 'ordered';
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
};

export type Tank = {
  id: string;
  user_id: string;
  name: string;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TankEvent = {
  id: string;
  tank_id: string;
  event_date: string;
  deaths: number;
  notes: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  created_at: string;
};

export type ParsedProduct = {
  product_name: string;
  quantity: number;
  price?: number;
};
