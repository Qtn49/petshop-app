-- Add restock_settings JSONB to organization for Square stock suggestions
ALTER TABLE organization
  ADD COLUMN IF NOT EXISTS restock_settings JSONB DEFAULT '{"min_stock_threshold": 5, "auto_check_on_login": false, "category_thresholds": {}}'::jsonb;

-- Add communication_settings JSONB to organization for communications integrations
ALTER TABLE organization
  ADD COLUMN IF NOT EXISTS communication_settings JSONB DEFAULT '{"gmail": {"enabled": false, "url": ""}, "outlook": {"enabled": false, "url": ""}, "slack": {"enabled": false, "url": ""}, "whatsapp": {"enabled": false, "url": ""}, "sms": {"enabled": false, "url": ""}}'::jsonb;
