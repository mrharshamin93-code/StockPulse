export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          app_version: string | null
          event_name: string
          id: number
          occurred_at: string
          platform: string | null
          properties: Json
          route: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          event_name: string
          id?: number
          occurred_at?: string
          platform?: string | null
          properties?: Json
          route?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          event_name?: string
          id?: number
          occurred_at?: string
          platform?: string | null
          properties?: Json
          route?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      app_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          route: string | null
          source_id: string | null
          source_type: string | null
          ticker: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          route?: string | null
          source_id?: string | null
          source_type?: string | null
          ticker?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          route?: string | null
          source_id?: string | null
          source_type?: string | null
          ticker?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      grok_api_usage: {
        Row: {
          cost_ticks: number
          cost_usd: number | null
          created_at: string
          function_name: string
          id: number
          metadata: Json
          model: string
          purpose: string | null
          ticker: string | null
          tool_calls: number
        }
        Insert: {
          cost_ticks?: number
          cost_usd?: number | null
          created_at?: string
          function_name: string
          id?: number
          metadata?: Json
          model: string
          purpose?: string | null
          ticker?: string | null
          tool_calls?: number
        }
        Update: {
          cost_ticks?: number
          cost_usd?: number | null
          created_at?: string
          function_name?: string
          id?: number
          metadata?: Json
          model?: string
          purpose?: string | null
          ticker?: string | null
          tool_calls?: number
        }
        Relationships: []
      }
      market_data_cache: {
        Row: {
          cache_key: string
          created_at: string
          data_type: string
          expires_at: string | null
          fetched_at: string | null
          parameters: Json
          payload: Json | null
          provider_error: string | null
          provider_request_units: number
          refresh_count: number
          refresh_locked_until: string | null
          retry_after: string | null
          stale_until: string | null
          ticker: string | null
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data_type: string
          expires_at?: string | null
          fetched_at?: string | null
          parameters?: Json
          payload?: Json | null
          provider_error?: string | null
          provider_request_units?: number
          refresh_count?: number
          refresh_locked_until?: string | null
          retry_after?: string | null
          stale_until?: string | null
          ticker?: string | null
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data_type?: string
          expires_at?: string | null
          fetched_at?: string | null
          parameters?: Json
          payload?: Json | null
          provider_error?: string | null
          provider_request_units?: number
          refresh_count?: number
          refresh_locked_until?: string | null
          retry_after?: string | null
          stale_until?: string | null
          ticker?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monthly_report_deliveries: {
        Row: {
          attempt_count: number
          cost_basis: number | null
          created_at: string
          delivery_kind: string
          error_message: string | null
          failed_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          gain_loss: number | null
          gain_loss_percent: number | null
          generated_at: string | null
          id: string
          metadata: Json
          portfolio_value: number | null
          processing_started_at: string | null
          provider_message_id: string | null
          recipient_email: string
          report_currency: string
          report_month: string
          report_timezone: string
          scheduled_for: string
          sent_at: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          cost_basis?: number | null
          created_at?: string
          delivery_kind?: string
          error_message?: string | null
          failed_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          gain_loss?: number | null
          gain_loss_percent?: number | null
          generated_at?: string | null
          id?: string
          metadata?: Json
          portfolio_value?: number | null
          processing_started_at?: string | null
          provider_message_id?: string | null
          recipient_email: string
          report_currency?: string
          report_month: string
          report_timezone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          cost_basis?: number | null
          created_at?: string
          delivery_kind?: string
          error_message?: string | null
          failed_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          gain_loss?: number | null
          gain_loss_percent?: number | null
          generated_at?: string | null
          id?: string
          metadata?: Json
          portfolio_value?: number | null
          processing_started_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          report_currency?: string
          report_month?: string
          report_timezone?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_tier: string
          created_at: string | null
          currency: string
          email: string | null
          full_name: string | null
          grandfathered_free: boolean
          id: string
          monthly_report_last_generated_at: string | null
          monthly_report_last_sent_at: string | null
          monthly_report_opt_in: boolean | null
          report_currency: string
          report_timezone: string
          role: string | null
          subscription_environment: string | null
          subscription_expires_at: string | null
          subscription_original_transaction_id: string | null
          subscription_product_id: string | null
          subscription_verified_at: string | null
          theme: string
          updated_at: string
          watchlist_sort: string
        }
        Insert: {
          access_tier?: string
          created_at?: string | null
          currency?: string
          email?: string | null
          full_name?: string | null
          grandfathered_free?: boolean
          id: string
          monthly_report_last_generated_at?: string | null
          monthly_report_last_sent_at?: string | null
          monthly_report_opt_in?: boolean | null
          report_currency?: string
          report_timezone?: string
          role?: string | null
          subscription_environment?: string | null
          subscription_expires_at?: string | null
          subscription_original_transaction_id?: string | null
          subscription_product_id?: string | null
          subscription_verified_at?: string | null
          theme?: string
          updated_at?: string
          watchlist_sort?: string
        }
        Update: {
          access_tier?: string
          created_at?: string | null
          currency?: string
          email?: string | null
          full_name?: string | null
          grandfathered_free?: boolean
          id?: string
          monthly_report_last_generated_at?: string | null
          monthly_report_last_sent_at?: string | null
          monthly_report_opt_in?: boolean | null
          report_currency?: string
          report_timezone?: string
          role?: string | null
          subscription_environment?: string | null
          subscription_expires_at?: string | null
          subscription_original_transaction_id?: string | null
          subscription_product_id?: string | null
          subscription_verified_at?: string | null
          theme?: string
          updated_at?: string
          watchlist_sort?: string
        }
        Relationships: []
      }
      provider_api_usage_daily: {
        Row: {
          endpoint: string
          failure_count: number
          provider: string
          request_count: number
          request_units: number
          success_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          endpoint: string
          failure_count?: number
          provider: string
          request_count?: number
          request_units?: number
          success_count?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          endpoint?: string
          failure_count?: number
          provider?: string
          request_count?: number
          request_units?: number
          success_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      provider_api_usage_monthly: {
        Row: {
          failure_count: number
          month_start: string
          provider: string
          request_count: number
          request_units: number
          success_count: number
          updated_at: string
        }
        Insert: {
          failure_count?: number
          month_start: string
          provider: string
          request_count?: number
          request_units?: number
          success_count?: number
          updated_at?: string
        }
        Update: {
          failure_count?: number
          month_start?: string
          provider?: string
          request_count?: number
          request_units?: number
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          app_id: string
          created_at: string
          enabled: boolean
          environment: string
          id: string
          invalidated_at: string | null
          last_error: string | null
          last_registered_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_id?: string
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          invalidated_at?: string | null
          last_error?: string | null
          last_registered_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_id?: string
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          invalidated_at?: string | null
          last_error?: string | null
          last_registered_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_screens: {
        Row: {
          active_metrics: Json | null
          created_at: string | null
          filters: Json | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          active_metrics?: Json | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          active_metrics?: Json | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          condition: string
          created_at: string | null
          enabled: boolean | null
          id: string
          last_checked_at: string | null
          last_checked_price: number | null
          notification_error: string | null
          notification_sent_at: string | null
          push_error: string | null
          push_sent_at: string | null
          target_price: number
          ticker: string
          triggered: boolean | null
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_checked_at?: string | null
          last_checked_price?: number | null
          notification_error?: string | null
          notification_sent_at?: string | null
          push_error?: string | null
          push_sent_at?: string | null
          target_price: number
          ticker: string
          triggered?: boolean | null
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_checked_at?: string | null
          last_checked_price?: number | null
          notification_error?: string | null
          notification_sent_at?: string | null
          push_error?: string | null
          push_sent_at?: string | null
          target_price?: number
          ticker?: string
          triggered?: boolean | null
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_analysis_cache: {
        Row: {
          analysis: Json
          company_name: string | null
          expires_at: string
          fetched_at: string
          ticker: string
          updated_at: string
        }
        Insert: {
          analysis: Json
          company_name?: string | null
          expires_at: string
          fetched_at?: string
          ticker: string
          updated_at?: string
        }
        Update: {
          analysis?: Json
          company_name?: string | null
          expires_at?: string
          fetched_at?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_analysis_popular_universe: {
        Row: {
          company_name: string | null
          created_at: string
          rank: number
          ticker: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          rank: number
          ticker: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          rank?: number
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_analysis_refresh_queue: {
        Row: {
          attempts: number
          last_error: string | null
          reason: string | null
          requested_at: string
          ticker: string
        }
        Insert: {
          attempts?: number
          last_error?: string | null
          reason?: string | null
          requested_at?: string
          ticker: string
        }
        Update: {
          attempts?: number
          last_error?: string | null
          reason?: string | null
          requested_at?: string
          ticker?: string
        }
        Relationships: []
      }
      stock_daily_price_backfill_status: {
        Row: {
          checked_at: string
          error: string | null
          rows_stored: number
          success: boolean
          ticker: string
        }
        Insert: {
          checked_at?: string
          error?: string | null
          rows_stored?: number
          success?: boolean
          ticker: string
        }
        Update: {
          checked_at?: string
          error?: string | null
          rows_stored?: number
          success?: boolean
          ticker?: string
        }
        Relationships: []
      }
      stock_daily_prices: {
        Row: {
          close: number
          created_at: string
          high: number | null
          low: number | null
          open: number | null
          ticker: string
          trading_date: string
          updated_at: string
        }
        Insert: {
          close: number
          created_at?: string
          high?: number | null
          low?: number | null
          open?: number | null
          ticker: string
          trading_date: string
          updated_at?: string
        }
        Update: {
          close?: number
          created_at?: string
          high?: number | null
          low?: number | null
          open?: number | null
          ticker?: string
          trading_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_intraday_snapshots: {
        Row: {
          bucket_start: string
          created_at: string
          price: number
          source_fetched_at: string
          ticker: string
          updated_at: string
        }
        Insert: {
          bucket_start: string
          created_at?: string
          price: number
          source_fetched_at: string
          ticker: string
          updated_at?: string
        }
        Update: {
          bucket_start?: string
          created_at?: string
          price?: number
          source_fetched_at?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_news_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_at: string
          grok_cost_ticks: number | null
          grok_tool_calls: number | null
          id: number
          image: string | null
          provider: string
          published_at: number | null
          published_date: string | null
          source: string | null
          summary: string | null
          ticker: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          fetched_at?: string
          grok_cost_ticks?: number | null
          grok_tool_calls?: number | null
          id?: number
          image?: string | null
          provider: string
          published_at?: number | null
          published_date?: string | null
          source?: string | null
          summary?: string | null
          ticker: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          grok_cost_ticks?: number | null
          grok_tool_calls?: number | null
          id?: number
          image?: string | null
          provider?: string
          published_at?: number | null
          published_date?: string | null
          source?: string | null
          summary?: string | null
          ticker?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      stock_news_refresh_queue: {
        Row: {
          attempts: number
          last_error: string | null
          reason: string
          requested_at: string
          ticker: string
        }
        Insert: {
          attempts?: number
          last_error?: string | null
          reason?: string
          requested_at?: string
          ticker: string
        }
        Update: {
          attempts?: number
          last_error?: string | null
          reason?: string
          requested_at?: string
          ticker?: string
        }
        Relationships: []
      }
      stock_screener_stocks: {
        Row: {
          asset_turnover: number | null
          book_value_per_share: number | null
          bullish_ma_crossover_at: string | null
          bullish_ma_crossover_days_ago: number | null
          change_amount: number | null
          change_percent: number | null
          cik: string | null
          company_name: string
          country: string | null
          created_at: string
          currency: string
          current_ratio: number | null
          data_source: string
          day_high: number | null
          day_low: number | null
          days_sales_outstanding: number | null
          debt_to_ebitda: number | null
          debt_to_equity: number | null
          dividend_growth_5y: number | null
          dividend_yield: number | null
          ebitda_growth_yoy: number | null
          enterprise_value_b: number | null
          eps_growth_yoy: number | null
          eps_ttm: number | null
          ev_ebitda: number | null
          exchange: string | null
          fcf_growth_yoy: number | null
          fcf_per_share: number | null
          figi: string | null
          forward_pe: number | null
          fundamentals_checked_at: string | null
          fundamentals_error: string | null
          fundamentals_source: string | null
          fundamentals_updated_at: string | null
          gross_margin: number | null
          high_52_week: number | null
          industry: string | null
          interest_coverage: number | null
          inventory_turnover: number | null
          is_active: boolean
          is_common_stock: boolean
          logo_url: string | null
          low_52_week: number | null
          market_cap_b: number | null
          market_timestamp: string | null
          mic: string | null
          net_margin: number | null
          open_price: number | null
          operating_margin: number | null
          payout_ratio: number | null
          pb: number | null
          pcf: number | null
          pe: number | null
          peg: number | null
          pfcf: number | null
          previous_close: number | null
          price: number | null
          price_above_sma_20: boolean | null
          ps: number | null
          quick_ratio: number | null
          quote_checked_at: string | null
          quote_error: string | null
          quote_updated_at: string | null
          receivables_turnover: number | null
          return_1_month: number | null
          return_1_week: number | null
          return_3_month: number | null
          revenue_growth_yoy: number | null
          roa: number | null
          roe: number | null
          roic: number | null
          rsi_14: number | null
          sec_facts_checked_at: string | null
          sec_facts_coverage: string | null
          sec_facts_error: string | null
          sec_facts_metric_count: number | null
          sec_facts_updated_at: string | null
          sec_last_seen_at: string | null
          sec_latest_filing_date: string | null
          sec_latest_fiscal_period: string | null
          sec_latest_fiscal_year: number | null
          sec_missing_syncs: number
          sector: string | null
          security_type: string | null
          sic: number | null
          sic_description: string | null
          sma_20: number | null
          sma_20_above_sma_50: boolean | null
          sma_50: number | null
          symbol: string
          technicals_checked_at: string | null
          technicals_error: string | null
          technicals_updated_at: string | null
          universe_updated_at: string | null
          updated_at: string
          volatility_30d: number | null
          volume: number | null
          website_url: string | null
          week_52_change: number | null
        }
        Insert: {
          asset_turnover?: number | null
          book_value_per_share?: number | null
          bullish_ma_crossover_at?: string | null
          bullish_ma_crossover_days_ago?: number | null
          change_amount?: number | null
          change_percent?: number | null
          cik?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          currency?: string
          current_ratio?: number | null
          data_source?: string
          day_high?: number | null
          day_low?: number | null
          days_sales_outstanding?: number | null
          debt_to_ebitda?: number | null
          debt_to_equity?: number | null
          dividend_growth_5y?: number | null
          dividend_yield?: number | null
          ebitda_growth_yoy?: number | null
          enterprise_value_b?: number | null
          eps_growth_yoy?: number | null
          eps_ttm?: number | null
          ev_ebitda?: number | null
          exchange?: string | null
          fcf_growth_yoy?: number | null
          fcf_per_share?: number | null
          figi?: string | null
          forward_pe?: number | null
          fundamentals_checked_at?: string | null
          fundamentals_error?: string | null
          fundamentals_source?: string | null
          fundamentals_updated_at?: string | null
          gross_margin?: number | null
          high_52_week?: number | null
          industry?: string | null
          interest_coverage?: number | null
          inventory_turnover?: number | null
          is_active?: boolean
          is_common_stock?: boolean
          logo_url?: string | null
          low_52_week?: number | null
          market_cap_b?: number | null
          market_timestamp?: string | null
          mic?: string | null
          net_margin?: number | null
          open_price?: number | null
          operating_margin?: number | null
          payout_ratio?: number | null
          pb?: number | null
          pcf?: number | null
          pe?: number | null
          peg?: number | null
          pfcf?: number | null
          previous_close?: number | null
          price?: number | null
          price_above_sma_20?: boolean | null
          ps?: number | null
          quick_ratio?: number | null
          quote_checked_at?: string | null
          quote_error?: string | null
          quote_updated_at?: string | null
          receivables_turnover?: number | null
          return_1_month?: number | null
          return_1_week?: number | null
          return_3_month?: number | null
          revenue_growth_yoy?: number | null
          roa?: number | null
          roe?: number | null
          roic?: number | null
          rsi_14?: number | null
          sec_facts_checked_at?: string | null
          sec_facts_coverage?: string | null
          sec_facts_error?: string | null
          sec_facts_metric_count?: number | null
          sec_facts_updated_at?: string | null
          sec_last_seen_at?: string | null
          sec_latest_filing_date?: string | null
          sec_latest_fiscal_period?: string | null
          sec_latest_fiscal_year?: number | null
          sec_missing_syncs?: number
          sector?: string | null
          security_type?: string | null
          sic?: number | null
          sic_description?: string | null
          sma_20?: number | null
          sma_20_above_sma_50?: boolean | null
          sma_50?: number | null
          symbol: string
          technicals_checked_at?: string | null
          technicals_error?: string | null
          technicals_updated_at?: string | null
          universe_updated_at?: string | null
          updated_at?: string
          volatility_30d?: number | null
          volume?: number | null
          website_url?: string | null
          week_52_change?: number | null
        }
        Update: {
          asset_turnover?: number | null
          book_value_per_share?: number | null
          bullish_ma_crossover_at?: string | null
          bullish_ma_crossover_days_ago?: number | null
          change_amount?: number | null
          change_percent?: number | null
          cik?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          currency?: string
          current_ratio?: number | null
          data_source?: string
          day_high?: number | null
          day_low?: number | null
          days_sales_outstanding?: number | null
          debt_to_ebitda?: number | null
          debt_to_equity?: number | null
          dividend_growth_5y?: number | null
          dividend_yield?: number | null
          ebitda_growth_yoy?: number | null
          enterprise_value_b?: number | null
          eps_growth_yoy?: number | null
          eps_ttm?: number | null
          ev_ebitda?: number | null
          exchange?: string | null
          fcf_growth_yoy?: number | null
          fcf_per_share?: number | null
          figi?: string | null
          forward_pe?: number | null
          fundamentals_checked_at?: string | null
          fundamentals_error?: string | null
          fundamentals_source?: string | null
          fundamentals_updated_at?: string | null
          gross_margin?: number | null
          high_52_week?: number | null
          industry?: string | null
          interest_coverage?: number | null
          inventory_turnover?: number | null
          is_active?: boolean
          is_common_stock?: boolean
          logo_url?: string | null
          low_52_week?: number | null
          market_cap_b?: number | null
          market_timestamp?: string | null
          mic?: string | null
          net_margin?: number | null
          open_price?: number | null
          operating_margin?: number | null
          payout_ratio?: number | null
          pb?: number | null
          pcf?: number | null
          pe?: number | null
          peg?: number | null
          pfcf?: number | null
          previous_close?: number | null
          price?: number | null
          price_above_sma_20?: boolean | null
          ps?: number | null
          quick_ratio?: number | null
          quote_checked_at?: string | null
          quote_error?: string | null
          quote_updated_at?: string | null
          receivables_turnover?: number | null
          return_1_month?: number | null
          return_1_week?: number | null
          return_3_month?: number | null
          revenue_growth_yoy?: number | null
          roa?: number | null
          roe?: number | null
          roic?: number | null
          rsi_14?: number | null
          sec_facts_checked_at?: string | null
          sec_facts_coverage?: string | null
          sec_facts_error?: string | null
          sec_facts_metric_count?: number | null
          sec_facts_updated_at?: string | null
          sec_last_seen_at?: string | null
          sec_latest_filing_date?: string | null
          sec_latest_fiscal_period?: string | null
          sec_latest_fiscal_year?: number | null
          sec_missing_syncs?: number
          sector?: string | null
          security_type?: string | null
          sic?: number | null
          sic_description?: string | null
          sma_20?: number | null
          sma_20_above_sma_50?: boolean | null
          sma_50?: number | null
          symbol?: string
          technicals_checked_at?: string | null
          technicals_error?: string | null
          technicals_updated_at?: string | null
          universe_updated_at?: string | null
          updated_at?: string
          volatility_30d?: number | null
          volume?: number | null
          website_url?: string | null
          week_52_change?: number | null
        }
        Relationships: []
      }
      stock_sync_runs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: number
          job_name: string
          metadata: Json
          started_at: string
          status: string
          symbols_failed: number
          symbols_processed: number
          symbols_requested: number
          symbols_succeeded: number
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name: string
          metadata?: Json
          started_at?: string
          status: string
          symbols_failed?: number
          symbols_processed?: number
          symbols_requested?: number
          symbols_succeeded?: number
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          metadata?: Json
          started_at?: string
          status?: string
          symbols_failed?: number
          symbols_processed?: number
          symbols_requested?: number
          symbols_succeeded?: number
        }
        Relationships: []
      }
      stock_transactions: {
        Row: {
          company_name: string
          created_at: string | null
          id: string
          price: number | null
          quantity: number | null
          stock_id: string | null
          ticker: string
          total: number
          type: string | null
          user_id: string
        }
        Insert: {
          company_name?: string
          created_at?: string | null
          id?: string
          price?: number | null
          quantity?: number | null
          stock_id?: string | null
          ticker: string
          total: number
          type?: string | null
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string | null
          id?: string
          price?: number | null
          quantity?: number | null
          stock_id?: string | null
          ticker?: string
          total?: number
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          cached_change: number | null
          cached_change_pct: number | null
          cached_price: number | null
          company_name: string | null
          created_at: string | null
          current_price: number | null
          id: string
          purchase_price: number
          quantity: number
          sector: string | null
          ticker: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cached_change?: number | null
          cached_change_pct?: number | null
          cached_price?: number | null
          company_name?: string | null
          created_at?: string | null
          current_price?: number | null
          id?: string
          purchase_price?: number
          quantity?: number
          sector?: string | null
          ticker: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cached_change?: number | null
          cached_change_pct?: number | null
          cached_price?: number | null
          company_name?: string | null
          created_at?: string | null
          current_price?: number | null
          id?: string
          purchase_price?: number
          quantity?: number
          sector?: string | null
          ticker?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          cached_change: number | null
          cached_change_pct: number | null
          cached_price: number | null
          company_name: string | null
          created_at: string | null
          exchange: string | null
          id: string
          ticker: string
          updated_at: string
          user_id: string
          watchlist_id: string
        }
        Insert: {
          cached_change?: number | null
          cached_change_pct?: number | null
          cached_price?: number | null
          company_name?: string | null
          created_at?: string | null
          exchange?: string | null
          id?: string
          ticker: string
          updated_at?: string
          user_id: string
          watchlist_id: string
        }
        Update: {
          cached_change?: number | null
          cached_change_pct?: number | null
          cached_price?: number | null
          company_name?: string | null
          created_at?: string | null
          exchange?: string | null
          id?: string
          ticker?: string
          updated_at?: string
          user_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_market_data_refresh: {
        Args: {
          p_cache_key: string
          p_data_type: string
          p_lease_seconds?: number
          p_parameters: Json
          p_ticker: string
        }
        Returns: boolean
      }
      claim_next_monthly_report_delivery: {
        Args: { p_max_attempts?: number }
        Returns: {
          attempt_count: number
          cost_basis: number | null
          created_at: string
          delivery_kind: string
          error_message: string | null
          failed_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          gain_loss: number | null
          gain_loss_percent: number | null
          generated_at: string | null
          id: string
          metadata: Json
          portfolio_value: number | null
          processing_started_at: string | null
          provider_message_id: string | null
          recipient_email: string
          report_currency: string
          report_month: string
          report_timezone: string
          scheduled_for: string
          sent_at: string | null
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "monthly_report_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_old_intraday_snapshots: { Args: never; Returns: number }
      cleanup_stock_daily_prices: { Args: { p_keep?: number }; Returns: number }
      complete_market_data_refresh: {
        Args: {
          p_cache_key: string
          p_fresh_seconds: number
          p_payload: Json
          p_request_units?: number
          p_stale_seconds: number
        }
        Returns: undefined
      }
      execute_stock_trade: {
        Args: {
          p_company_name: string
          p_current_price?: number
          p_price: number
          p_quantity: number
          p_sector?: string
          p_stock_id?: string
          p_ticker: string
          p_trade_type: string
        }
        Returns: Json
      }
      fail_market_data_refresh: {
        Args: { p_cache_key: string; p_error: string; p_retry_seconds?: number }
        Returns: undefined
      }
      finish_stock_daily_prices_backfill: { Args: never; Returns: boolean }
      get_stock_daily_price_backfill_queue: {
        Args: { p_limit?: number }
        Returns: {
          symbol: string
        }[]
      }
      get_stock_sparklines: {
        Args: { p_limit?: number; p_tickers: string[] }
        Returns: {
          close: number
          ticker: string
          trading_date: string
        }[]
      }
      next_watchlist_analysis_ticker: { Args: never; Returns: string }
      next_watchlist_news_ticker: { Args: never; Returns: string }
      queue_scheduled_monthly_reports: {
        Args: { p_daily_limit?: number; p_report_month?: string }
        Returns: number
      }
      record_daily_market_close: {
        Args: { p_trading_date?: string }
        Returns: number
      }
      record_provider_request_result: {
        Args: {
          p_endpoint: string
          p_provider: string
          p_request_units: number
          p_success: boolean
        }
        Returns: undefined
      }
      request_monthly_report_now: {
        Args: { p_currency?: string; p_timezone?: string }
        Returns: string
      }
      reserve_provider_request: {
        Args: {
          p_monthly_limit?: number
          p_priority?: boolean
          p_provider: string
          p_request_units?: number
          p_reserved_units?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
