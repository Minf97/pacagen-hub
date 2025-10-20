// pacagen-shopify-order.ts

export interface Money {
  amount: string;
  currency_code: string;
}

export interface MoneySet {
  shop_money: Money;
  presentment_money: Money;
}

export interface PriceSet extends MoneySet {}

export interface ClientDetails {
  accept_language: string | null;
  browser_height: number | null;
  browser_ip: string | null;
  browser_width: number | null;
  session_hash: string | null;
  user_agent: string | null;
}

export interface TaxLine {
  price: string;
  rate: number;
  title: string;
  price_set: PriceSet;
  channel_liable: boolean;
}

export interface Address {
  first_name: string | null;
  last_name: string | null;
  name?: string | null; // sometimes present as combined name
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  zip: string | null;
  phone: string | null;
  company: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country_code?: string | null;
  province_code?: string | null;
  default?: boolean;
}

export interface LineItemTaxLine {
  channel_liable: boolean;
  price: string;
  price_set: PriceSet;
  rate: number;
  title: string;
}

export interface LineItem {
  id: number;
  admin_graphql_api_id?: string;
  attributed_staffs: any[]; // unknown structure in sample, keep as any[]
  current_quantity: number;
  fulfillable_quantity: number;
  fulfillment_service: string | null;
  fulfillment_status: string | null;
  gift_card: boolean;
  grams: number;
  name: string;
  pre_tax_price: string;
  pre_tax_price_set: PriceSet;
  price: string;
  price_set: PriceSet;
  product_exists: boolean;
  product_id?: number | null;
  properties: any[]; // usually array of {name,value} but sample empty
  quantity: number;
  requires_shipping: boolean;
  sales_line_item_group_id?: string | null;
  sku: string | null;
  taxable: boolean;
  title: string;
  total_discount: string;
  total_discount_set?: PriceSet | null;
  variant_id?: number | null;
  variant_inventory_management?: string | null;
  variant_title?: string | null;
  vendor?: string | null;
  tax_lines: LineItemTaxLine[];
  duties: any[]; // ignored structure
  discount_allocations: any[]; // ignored structure
}

export interface ShippingLineTaxLine {
  channel_liable: boolean;
  price: string;
  price_set: PriceSet;
  rate: number;
  title: string;
}

export interface ShippingLine {
  id: number;
  carrier_identifier?: string | null;
  code: string;
  current_discounted_price_set?: PriceSet | null;
  discounted_price?: string | null;
  discounted_price_set?: PriceSet | null;
  is_removed?: boolean;
  phone?: string | null;
  price: string;
  price_set?: PriceSet | null;
  requested_fulfillment_service_id?: string | null;
  source?: string | null;
  title?: string | null;
  tax_lines: ShippingLineTaxLine[];
  discount_allocations: any[];
}

export interface CustomerAddress {
  id: number;
  customer_id: number;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
  name?: string | null;
  province_code?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  default?: boolean;
}

export interface Customer {
  id: number;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  state?: string | null;
  note?: string | null;
  verified_email?: boolean;
  multipass_identifier?: string | null;
  tax_exempt?: boolean;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  tax_exemptions?: any[];
  admin_graphql_api_id?: string;
  default_address?: CustomerAddress | null;
}

export interface ShopifyOrder {
  id: number;
  admin_graphql_api_id?: string;
  app_id?: number | null;
  browser_ip?: string | null;
  buyer_accepts_marketing?: boolean;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  cart_token?: string | null;
  checkout_id?: string | null;
  checkout_token?: string | null;
  client_details?: ClientDetails | null;
  closed_at?: string | null;
  company?: string | null;
  confirmation_number?: string | null;
  confirmed?: boolean;
  contact_email?: string | null;
  created_at?: string;
  currency?: string | null;
  current_shipping_price_set?: PriceSet | null;
  current_subtotal_price?: string | null;
  current_subtotal_price_set?: PriceSet | null;
  current_total_additional_fees_set?: any | null;
  current_total_discounts?: string | null;
  current_total_discounts_set?: PriceSet | null;
  current_total_duties_set?: any | null;
  current_total_price?: string | null;
  current_total_price_set?: PriceSet | null;
  current_total_tax?: string | null;
  current_total_tax_set?: PriceSet | null;
  customer_locale?: string | null;
  device_id?: string | null;
  discount_codes?: any[];
  duties_included?: boolean;
  email?: string | null;
  estimated_taxes?: boolean;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  landing_site?: string | null;
  landing_site_ref?: string | null;
  location_id?: number | null;
  merchant_business_entity_id?: string | null;
  merchant_of_record_app_id?: string | null;
  name?: string | null;
  note?: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
  number?: number;
  order_number?: number;
  order_status_url?: string | null;
  original_total_additional_fees_set?: any | null;
  original_total_duties_set?: any | null;
  payment_gateway_names?: string[];
  phone?: string | null;
  po_number?: string | null;
  presentment_currency?: string | null;
  processed_at?: string | null;
  reference?: string | null;
  referring_site?: string | null;
  source_identifier?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  subtotal_price?: string | null;
  subtotal_price_set?: PriceSet | null;
  tags?: string | null;
  tax_exempt?: boolean;
  tax_lines?: TaxLine[];
  taxes_included?: boolean;
  test?: boolean;
  token?: string | null;
  total_cash_rounding_payment_adjustment_set?: PriceSet | null;
  total_cash_rounding_refund_adjustment_set?: PriceSet | null;
  total_discounts?: string | null;
  total_discounts_set?: PriceSet | null;
  total_line_items_price?: string | null;
  total_line_items_price_set?: PriceSet | null;
  total_outstanding?: string | null;
  total_price?: string | null;
  total_price_set?: PriceSet | null;
  total_shipping_price_set?: PriceSet | null;
  total_tax?: string | null;
  total_tax_set?: PriceSet | null;
  total_tip_received?: string | null;
  total_weight?: number;
  updated_at?: string | null;
  user_id?: number | null;
  billing_address?: Address | null;
  customer?: Customer | null;
  discount_applications?: any[];
  fulfillments?: any[];
  line_items?: LineItem[];
  payment_terms?: any | null;
  refunds?: any[];
  shipping_address?: Address | null;
  shipping_lines?: ShippingLine[];
  returns?: any[];
  line_item_groups?: any[];
}
