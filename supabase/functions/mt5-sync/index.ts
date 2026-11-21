import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const CLIENT_BASE = 'https://mt-client-api-v1.new-york.agiliumtrade.ai';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const metaApiToken = Deno.env.get('METAAPI_TOKEN');

    if (!metaApiToken) {
      throw new Error('METAAPI_TOKEN secret is not configured in Supabase.');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // --- ACTION 1: CONNECT MT5 ACCOUNT ---
    if (action === 'connect') {
      const { accountId, accountName, login, investorPassword, server } = body;

      if (!accountId || !login || !investorPassword || !server) {
        throw new Error('Account ID, MT5 Login, Investor Password, and Server are required.');
      }

      // 1. Provision read-only MT5 account on MetaApi
      const provisionRes = await fetch(`${PROVISIONING_BASE}/users/current/accounts`, {
        method: 'POST',
        headers: {
          'auth-token': metaApiToken,
          'Content-Type': 'application/json',
          'transaction-id': crypto.randomUUID().replace(/-/g, ''),
        },
        body: JSON.stringify({
          name: accountName || `MT5-${login}`,
          type: 'cloud-g2',
          login: String(login).trim(),
          password: investorPassword,
          server: server.trim(),
          platform: 'mt5',
          magic: 0,
        }),
      });

      const provisionData = await provisionRes.json();
      if (!provisionRes.ok) {
        throw new Error(provisionData.message || 'MetaApi failed to register MT5 credentials.');
      }

      const metaapiAccountId = provisionData.id;

      // 2. Deploy the MetaApi cloud terminal
      await fetch(`${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': metaApiToken },
      });

      // 3. Save MetaApi reference to Supabase (password is discarded)
      const { error: updateErr } = await supabase
        .from('trading_accounts')
        .update({
          mt5_login: String(login).trim(),
          mt5_server: server.trim(),
          metaapi_account_id: metaapiAccountId,
          auto_sync_enabled: true,
        })
        .eq('id', accountId)
        .eq('user_id', user.id);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, metaapiAccountId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- ACTION 2: SYNC CLOSED DEALS ---
    if (action === 'sync') {
      const { accountId } = body;

      const { data: account, error: accErr } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

      if (accErr || !account) throw new Error('Trading account not found.');
      if (!account.metaapi_account_id) {
        throw new Error('This account is not linked to MT5.');
      }

      // Fetch last 90 days of deal history from MetaApi
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const dealsUrl = `${CLIENT_BASE}/users/current/accounts/${account.metaapi_account_id}/history-deals/time/${encodeURIComponent(startTime)}/${encodeURIComponent(endTime)}`;

      const dealsRes = await fetch(dealsUrl, {
        headers: { 'auth-token': metaApiToken },
      });

      const deals = await dealsRes.json();
      if (!dealsRes.ok) {
        throw new Error(
          deals.message || 'MT5 terminal is still connecting to broker. Try again in 30 seconds.'
        );
      }

      // Keep only closed trade deals (DEAL_ENTRY_OUT / DEAL_ENTRY_INOUT)
      const closedDeals = (Array.isArray(deals) ? deals : []).filter(
        (d) =>
          (d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT') &&
          (d.type === 'DEAL_TYPE_BUY' || d.type === 'DEAL_TYPE_SELL')
      );

      const rowsToUpsert = closedDeals.map((d) => {
        // Exit deal type is opposite of original entry direction
        const originalDirection = d.type === 'DEAL_TYPE_SELL' ? 'BUY' : 'SELL';
        const netPnl =
          Number(d.profit || 0) + Number(d.swap || 0) + Number(d.commission || 0);
        const closeDate = (d.time || new Date().toISOString()).split('T')[0];

        return {
          user_id: user.id,
          account_id: account.id,
          mt5_deal_id: String(d.id),
          date: closeDate,
          asset: String(d.symbol || 'UNKNOWN').toUpperCase(),
          direction: originalDirection,
          lots: Number(d.volume || 0).toFixed(2),
          pnl: Number(netPnl.toFixed(2)),
        };
      });

      if (rowsToUpsert.length > 0) {
        const { error: upsertErr } = await supabase
          .from('trades')
          .upsert(rowsToUpsert, {
            onConflict: 'account_id,mt5_deal_id',
            ignoreDuplicates: true,
          });

        if (upsertErr) throw upsertErr;
      }

      await supabase
        .from('trading_accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', account.id);

      return new Response(
        JSON.stringify({ success: true, syncedCount: rowsToUpsert.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action.');
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});