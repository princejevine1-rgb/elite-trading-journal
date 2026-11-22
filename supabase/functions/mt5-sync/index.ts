import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchAccountMeta(token: string, metaapiAccountId: string) {
  const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}`, {
    headers: { 'auth-token': token },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `MetaApi account lookup failed (${res.status})`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const metaapiToken = Deno.env.get('METAAPI_TOKEN');
    if (!metaapiToken) {
      return jsonResponse({ error: 'METAAPI_TOKEN secret is not configured in Supabase.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!jwt) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const action = payload.action || (payload.accountId ? 'sync' : 'connect');

    // 1. CONNECT: Create account on MetaApi, deploy it, and save to trading_accounts
    if (action === 'connect') {
      const {
        accountId,
        accountName,
        login,
        mt5_login,
        password,
        investorPassword,
        server,
        mt5_server,
        region,
      } = payload;

      const tradingAccountId = String(accountId || '').trim();
      const mt5Login = String(login ?? mt5_login ?? '').trim();
      const mt5Server = String(server ?? mt5_server ?? '').trim();
      const mt5Password = String(password ?? investorPassword ?? '').trim();

      if (!tradingAccountId || !mt5Login || !mt5Server || !mt5Password) {
        return jsonResponse(
          { error: 'Account ID, MT5 login, investor password, and broker server are required.' },
          400
        );
      }

      const { data: tradingAccount, error: accountError } = await supabaseAdmin
        .from('trading_accounts')
        .select('id, name')
        .eq('id', tradingAccountId)
        .eq('user_id', userId)
        .single();
      if (accountError || !tradingAccount) {
        return jsonResponse({ error: 'Trading account not found in database.' }, 404);
      }

      const mt5AccountName = String(accountName || tradingAccount.name || `MT5 ${mt5Login}`).trim();
      const createBody: Record<string, unknown> = {
        name: mt5AccountName,
        type: 'cloud',
        login: mt5Login,
        password: mt5Password,
        server: mt5Server,
        platform: 'mt5',
        magic: 0,
      };
      if (region) createBody.region = region;

      const createRes = await fetch(`${PROVISIONING_BASE}/users/current/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': metaapiToken,
        },
        body: JSON.stringify(createBody),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !created?.id) {
        return jsonResponse(
          { error: created?.message || created?.error || `Failed to create MetaApi account (${createRes.status})` },
          400
        );
      }

      const metaapiAccountId = String(created.id);

      // Trigger deployment so MetaApi starts the cloud terminal
      await fetch(`${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': metaapiToken },
      }).catch(() => null);

      const { error: dbError } = await supabaseAdmin
        .from('trading_accounts')
        .update({
          mt5_login: mt5Login,
          mt5_server: mt5Server,
          metaapi_account_id: metaapiAccountId,
          auto_sync_enabled: true,
        })
        .eq('id', tradingAccountId)
        .eq('user_id', userId);

      if (dbError) {
        return jsonResponse({ error: dbError.message }, 400);
      }

      return jsonResponse({
        ok: true,
        metaapiAccountId,
        note: 'Account created and deploying on MetaApi. Wait ~30-60s before first trade sync.',
      });
    }

    // 2. SYNC: Fetch account region/state and pull closed deals from MetaApi Client API
    const accountId = payload.accountId || payload.account_id;
    if (!accountId) {
      return jsonResponse({ error: 'accountId is required for sync.' }, 400);
    }

    const query = supabaseAdmin
      .from('trading_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId);
    const { data: dbAccount, error: fetchErr } = await query.single();

    if (fetchErr || !dbAccount) {
      return jsonResponse({ error: 'Trading account not found in database.' }, 404);
    }

    const metaapiAccountId = dbAccount.metaapi_account_id;
    if (!metaapiAccountId) {
      return jsonResponse(
        { error: 'No metaapi_account_id linked to this trading account. Reconnect it first.' },
        400
      );
    }

    const accMeta = await fetchAccountMeta(metaapiToken, metaapiAccountId);
    if (accMeta.state !== 'DEPLOYED') {
      await fetch(`${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': metaapiToken },
      }).catch(() => null);

      return jsonResponse(
        {
          error: `Account state is "${accMeta.state}". Deployment has been triggered—wait 30-60 seconds and try Sync Now again.`,
        },
        409
      );
    }

    const accRegion = accMeta.region || 'new-york';
    const clientBase = `https://mt-client-api-v1.${accRegion}.agiliumtrade.ai`;

    // Fetch recent history deals (adjust startTime as needed)
    const startTime = encodeURIComponent(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
    const endTime = encodeURIComponent(new Date().toISOString());
    const dealsUrl = `${clientBase}/users/current/accounts/${metaapiAccountId}/history-deals/time/${startTime}/${endTime}`;

    const dealsRes = await fetch(dealsUrl, {
      headers: { 'auth-token': metaapiToken },
    });
    const dealsData = await dealsRes.json().catch(() => []);
    if (!dealsRes.ok) {
      return jsonResponse(
        { error: dealsData?.message || dealsData?.error || `Failed to fetch deals (${dealsRes.status})` },
        400
      );
    }

    const dealsArray = Array.isArray(dealsData) ? dealsData : [];
    const entryPriceByPosition = new Map<string, number>();
    for (const deal of dealsArray) {
      if (
        (deal.entryType === 'DEAL_ENTRY_IN' || deal.entryType === 'DEAL_ENTRY_INOUT') &&
        deal.positionId &&
        typeof deal.price === 'number' &&
        !entryPriceByPosition.has(String(deal.positionId))
      ) {
        entryPriceByPosition.set(String(deal.positionId), deal.price);
      }
    }

    const mappedTrades = dealsArray
      .filter(
        (deal) =>
          deal &&
          (deal.entryType === 'DEAL_ENTRY_OUT' ||
            deal.entryType === 'DEAL_ENTRY_INOUT' ||
            deal.entryType === 'DEAL_ENTRY_OUT_BY') &&
          (deal.type === 'DEAL_TYPE_BUY' || deal.type === 'DEAL_TYPE_SELL')
      )
      .map((deal) => {
        const closeDate = (deal.time || new Date().toISOString()).split('T')[0];
        const direction = deal.type === 'DEAL_TYPE_SELL' ? 'BUY' : 'SELL';
        const netPnl =
          Number(deal.profit || 0) + Number(deal.swap || 0) + Number(deal.commission || 0);
        const entryPrice = deal.positionId
          ? entryPriceByPosition.get(String(deal.positionId))
          : undefined;

        return {
          user_id: dbAccount.user_id,
          account_id: dbAccount.id,
          mt5_deal_id: String(deal.id),
          date: closeDate,
          asset: String(deal.symbol || 'UNKNOWN').toUpperCase(),
          direction,
          lots: Number(deal.volume || 0).toFixed(2),
          enp: entryPrice ?? null,
          exp: typeof deal.price === 'number' ? deal.price : null,
          pnl: Number(netPnl.toFixed(2)),
        };
      });

    if (mappedTrades.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('trades')
        .upsert(mappedTrades, { onConflict: 'account_id,mt5_deal_id' });
      if (upsertErr) {
        return jsonResponse({ error: upsertErr.message }, 400);
      }
    }

    await supabaseAdmin
      .from('trading_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', dbAccount.id);

    return jsonResponse({
      ok: true,
      region: accRegion,
      syncedCount: mappedTrades.length,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});