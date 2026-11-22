import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROVISIONING_BASE = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';
const LOOKBACK_DAYS = 14;
const BATCH_SIZE = 50;

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

    const payload = await req.json().catch(() => ({}));
    const action = payload.action || (payload.accountId ? 'sync' : 'connect');

    // 0. SEARCH SERVERS: Fuzzy search known MT5 broker servers via MetaApi
    if (action === 'search-servers') {
      const q = String(payload.query ?? '').trim();
      if (q.length < 2) {
        return jsonResponse({ ok: true, results: [] });
      }

      const searchUrl = `${PROVISIONING_BASE}/known-mt-servers/5/search?query=${encodeURIComponent(q)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'auth-token': metaapiToken },
      });
      const raw = await searchRes.json().catch(() => ({}));

      if (!searchRes.ok) {
        return jsonResponse(
          { error: raw?.message || raw?.error || `Server lookup failed (${searchRes.status})`, results: [] },
          400
        );
      }

      // MetaApi returns { "Broker Name": ["Server-1", "Server-2"], ... }
      const results: Array<{ broker: string; server: string }> = [];
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [broker, servers] of Object.entries(raw)) {
          if (Array.isArray(servers)) {
            for (const server of servers) {
              results.push({ broker, server: String(server) });
            }
          }
        }
      }

      return jsonResponse({ ok: true, results: results.slice(0, 25) });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | null = null;
    if (jwt) {
      const { data: userData } = await supabaseAdmin.auth.getUser(jwt);
      userId = userData?.user?.id ?? null;
    }

    // 1. CONNECT: Create & deploy account on MetaApi without custom name/amount
    if (action === 'connect') {
      const {
        login,
        mt5_login,
        password,
        investorPassword,
        server,
        mt5_server,
        region,
      } = payload;

      const mt5Login = String(login ?? mt5_login ?? '').trim();
      const mt5Server = String(server ?? mt5_server ?? '').trim();
      const mt5Password = String(password ?? investorPassword ?? '').trim();

      if (!mt5Login || !mt5Server || !mt5Password) {
        return jsonResponse(
          { error: 'MT5 login, investor password, and broker server are required.' },
          400
        );
      }

      const defaultLabel = `${mt5Server.split('-')[0]} • ${mt5Login}`;

      const createBody: Record<string, unknown> = {
        name: defaultLabel,
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

      await fetch(`${PROVISIONING_BASE}/users/current/accounts/${metaapiAccountId}/deploy`, {
        method: 'POST',
        headers: { 'auth-token': metaapiToken },
      }).catch(() => null);

      if (!userId) {
        return jsonResponse({ error: 'Authenticated user required to save account.' }, 401);
      }

      const { data: savedAccount, error: dbError } = await supabaseAdmin
        .from('trading_accounts')
        .insert({
          user_id: userId,
          name: defaultLabel,
          initial_balance: 0,
          balance: 0,
          equity: 0,
          mt5_login: mt5Login,
          mt5_server: mt5Server,
          metaapi_account_id: metaapiAccountId,
          auto_sync_enabled: true,
        })
        .select()
        .single();

      if (dbError) {
        return jsonResponse({ error: dbError.message }, 400);
      }

      return jsonResponse({
        ok: true,
        account: savedAccount,
        metaapiAccountId,
        note: 'Account created and deploying on MetaApi. Wait ~30-60s before first sync.',
      });
    }

    // 2. SYNC: Pull live balance/equity + 14-day closed deals
    const accountId = payload.accountId || payload.account_id;
    if (!accountId) {
      return jsonResponse({ error: 'accountId is required for sync.' }, 400);
    }

    let query = supabaseAdmin.from('trading_accounts').select('*').eq('id', accountId);
    if (userId) query = query.eq('user_id', userId);
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
          error: `Account state is "${accMeta.state}". Deployment triggered—wait 30-60 seconds and try again.`,
        },
        409
      );
    }

    const accRegion = accMeta.region || 'new-york';
    const clientBase = `https://mt-client-api-v1.${accRegion}.agiliumtrade.ai`;

    // Fetch live account information (balance, equity, currency, broker)
    let liveBalance: number | null = null;
    let liveEquity: number | null = null;
    let liveCurrency: string | null = null;
    let liveBroker: string | null = null;

    const infoRes = await fetch(
      `${clientBase}/users/current/accounts/${metaapiAccountId}/account-information`,
      { headers: { 'auth-token': metaapiToken } }
    );
    if (infoRes.ok) {
      const info = await infoRes.json().catch(() => null);
      if (info && typeof info === 'object') {
        if (typeof info.balance === 'number') liveBalance = Number(info.balance.toFixed(2));
        if (typeof info.equity === 'number') liveEquity = Number(info.equity.toFixed(2));
        if (typeof info.currency === 'string') liveCurrency = info.currency;
        if (typeof info.broker === 'string' && info.broker.trim()) liveBroker = info.broker.trim();
      }
    }

    // Fetch closed deals from the last 14 days
    const lookbackMs = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const startTime = encodeURIComponent(new Date(Date.now() - lookbackMs).toISOString());
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
    const mappedTrades = dealsArray
      .filter((d) => d && (d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT' || d.profit !== undefined))
      .map((d) => {
        const ts = d.time ? new Date(d.time) : new Date();
        const isoDate = ts.toISOString().slice(0, 10);
        const rawType = String(d.type || '');
        const direction = rawType.toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
        const profit = Number(d.profit ?? 0) + Number(d.commission ?? 0) + Number(d.swap ?? 0);

        return {
          user_id: dbAccount.user_id,
          account_id: dbAccount.id,
          date: isoDate,
          asset: String(d.symbol || 'UNKNOWN'),
          direction,
          lots: Number(d.volume ?? 0),
          enp: d.openPrice != null ? Number(d.openPrice) : null,
          exp: d.price != null ? Number(d.price) : null,
          pnl: Number(profit.toFixed(2)),
          mt5_position_id: String(d.id || d.positionId || crypto.randomUUID()),
        };
      });

    for (let i = 0; i < mappedTrades.length; i += BATCH_SIZE) {
      const batch = mappedTrades.slice(i, i + BATCH_SIZE);
      const { error: upsertErr } = await supabaseAdmin
        .from('trades')
        .upsert(batch, { onConflict: 'account_id,mt5_position_id' });
      if (upsertErr) {
        return jsonResponse({ error: upsertErr.message }, 400);
      }
    }

    // Update account balance, equity, and initial_balance (if not yet populated)
    const accountUpdates: Record<string, unknown> = {
      last_synced_at: new Date().toISOString(),
    };
    if (liveBalance !== null) {
      accountUpdates.balance = liveBalance;
      if (!dbAccount.initial_balance || Number(dbAccount.initial_balance) === 0) {
        const syncedNetPnl = mappedTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
        accountUpdates.initial_balance = Number((liveBalance - syncedNetPnl).toFixed(2));
      }
    }
    if (liveEquity !== null) {
      accountUpdates.equity = liveEquity;
    }
    if (liveCurrency) {
      accountUpdates.currency = liveCurrency;
    }
    if (liveBroker && dbAccount.mt5_login) {
      accountUpdates.name = `${liveBroker} • ${dbAccount.mt5_login}`;
    }

    const { data: updatedAccount } = await supabaseAdmin
      .from('trading_accounts')
      .update(accountUpdates)
      .eq('id', dbAccount.id)
      .select()
      .single();

    return jsonResponse({
      ok: true,
      region: accRegion,
      lookbackDays: LOOKBACK_DAYS,
      syncedCount: mappedTrades.length,
      balance: liveBalance,
      equity: liveEquity,
      currency: liveCurrency,
      account: updatedAccount ?? null,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});