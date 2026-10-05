// IT ARENA — mahalliy sinov serveri (Supabase oʻrnini bosuvchi MOCK).
//
// Haqiqiy migratsiyalar va seed PGlite (WASM PostgreSQL) da ishga tushiriladi,
// ilova esa xuddi Supabase'ga ulangandek ishlaydi: Auth (anonim kirish, email+parol),
// PostgREST (RPC, oddiy select/insert/update/delete) va RLS.
// Realtime yoʻq — ilova avtomatik ravishda har 3 soniyada yangilanadi.
//
// FAQAT ishlab chiqish, demo va avtomatik testlar uchun. Ishlab chiqarishda haqiqiy Supabase ishlatiladi.
//
// Ishga tushirish:
//   node scripts/mock-supabase.mjs            # http://localhost:54321
//   VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=mock npm run dev
// Oʻqituvchi: teacher@itarena.uz / arena12345  (MOCK_TEACHER_EMAIL, MOCK_TEACHER_PASSWORD bilan oʻzgartiriladi)
import http from 'node:http';
import { randomUUID, createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MOCK_PORT ?? 54321);
const TEACHER_EMAIL = process.env.MOCK_TEACHER_EMAIL ?? 'teacher@itarena.uz';
const TEACHER_PASSWORD = process.env.MOCK_TEACHER_PASSWORD ?? 'arena12345';
const SECRET = 'mock-secret-not-for-production';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    is_anonymous boolean not null default false
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

// ---------------------------------------------------------------- DB
const db = new PGlite();
await db.exec(SUPABASE_STUB);
const migrationsDir = join(ROOT, 'supabase', 'migrations');
for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
}
await db.exec(readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8'));

/** email → { id, password } */
const accounts = new Map();
/** refresh token → user id */
const refreshTokens = new Map();

async function createUser({ email = null, password = null, name = null, instructor = false } = {}) {
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values ($1, $2, $3, $4)`, [
    id,
    email,
    JSON.stringify(name ? { display_name: name } : {}),
    !email,
  ]);
  if (email) accounts.set(email.toLowerCase(), { id, password });
  if (instructor) await db.query(`select public.promote_to_instructor($1, $2)`, [email, name ?? 'Oʻqituvchi']);
  return id;
}
await createUser({ email: TEACHER_EMAIL, password: TEACHER_PASSWORD, name: 'Ustoz', instructor: true });

// Funksiya argumentlari va qaytish turlari (RPC uchun)
const functions = new Map();
for (const r of (
  await db.query(`
    select p.proname, coalesce(p.proargnames, '{}') as names,
           array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
           format_type(p.prorettype, null) as ret
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'`)
).rows) {
  functions.set(r.proname, { names: r.names, types: r.types, ret: r.ret });
}

// Jadval ustunlari turlari (insert/update uchun)
const columnTypes = new Map();
for (const r of (
  await db.query(`select table_name, column_name, format_type(a.atttypid, a.atttypmod) as type
                    from information_schema.columns c
                    join pg_attribute a on a.attname = c.column_name
                    join pg_class k on k.oid = a.attrelid and k.relname = c.table_name
                    join pg_namespace n on n.oid = k.relnamespace and n.nspname = 'public'
                   where c.table_schema = 'public'`)
).rows) {
  if (!columnTypes.has(r.table_name)) columnTypes.set(r.table_name, new Map());
  columnTypes.get(r.table_name).set(r.column_name, r.type);
}

// ---------------------------------------------------------------- JWT
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeJwt(userId, anonymous) {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: userId, role: 'authenticated', aud: 'authenticated', exp, is_anonymous: anonymous });
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return { token: `${head}.${body}.${sig}`, exp };
}
function userFromAuthHeader(req) {
  const m = (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const [head, body, sig] = m[1].split('.');
  if (!sig || createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url') !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp * 1000 > Date.now() ? p.sub : null;
  } catch {
    return null;
  }
}
async function sessionFor(userId) {
  const u = (await db.query(`select id, email, is_anonymous from auth.users where id = $1`, [userId])).rows[0];
  const { token, exp } = makeJwt(userId, u.is_anonymous);
  const refresh = randomUUID();
  refreshTokens.set(refresh, userId);
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: exp,
    refresh_token: refresh,
    user: userJson(u),
  };
}
function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email ?? '',
    is_anonymous: u.is_anonymous,
    app_metadata: { provider: u.is_anonymous ? 'anonymous' : 'email' },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- yordamchilar
function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...cors(), ...extra });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, range, x-supabase-api-version, x-retry-count',
    'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
  };
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
function pgError(e) {
  const code = e.code ?? 'P0001';
  const status = code === '42501' ? 403 : code === 'P0002' ? 404 : code === '23505' || code === '23503' ? 409 : 400;
  return { status, body: { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
}
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`Notoʻgʻri nom: ${s}`), { code: '42601' });
  return `"${s}"`;
};

/** Har bir soʻrov alohida tranzaksiyada, foydalanuvchi huquqi bilan (RLS ishlaydi) */
async function asUser(userId, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon');
    return fn(tx);
  });
}

// --- PostgREST: select roʻyxati (bir darajali bogʻlanishlar bilan: teams(...), players(count))
const EMBED_FK = { teams: 'room_id', players: 'room_id', game_questions: 'room_id' };
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function selectSql(table, select, alias = 't') {
  if (!select || select === '*') return `${alias}.*`;
  return splitTop(select)
    .map((item) => {
      const m = item.match(/^([a-z_]+)\((.*)\)$/);
      if (m) {
        const [, child, cols] = m;
        const fk = EMBED_FK[child];
        if (!fk) throw new Error(`Bogʻlanish qoʻllab-quvvatlanmaydi: ${child}`);
        if (cols.trim() === 'count') {
          return `(select jsonb_build_array(jsonb_build_object('count', count(*))) from public.${ident(child)} c where c.${ident(fk)} = ${alias}.id) as ${ident(child)}`;
        }
        const obj = splitTop(cols)
          .map((c) => `'${c}', c.${ident(c)}`)
          .join(', ');
        return `(select coalesce(jsonb_agg(jsonb_build_object(${obj})), '[]'::jsonb) from public.${ident(child)} c where c.${ident(fk)} = ${alias}.id) as ${ident(child)}`;
      }
      return `${alias}.${ident(item)}`;
    })
    .join(', ');
}
function whereSql(params, values, alias = 't') {
  const conds = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) continue;
    const m = raw.match(/^(eq|neq|gt|gte|lt|lte|is|in|ilike|like)\.(.*)$/);
    if (!m) continue;
    const [, op, val] = m;
    const col = `${alias}.${ident(key)}`;
    if (op === 'is') conds.push(`${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`);
    else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      values.push(items);
      conds.push(`${col}::text = any($${values.length}::text[])`);
    } else {
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', ilike: 'ilike', like: 'like' }[op];
      values.push(val);
      conds.push(`${col}::text ${sqlOp} $${values.length}`);
    }
  }
  return conds.length ? `where ${conds.join(' and ')}` : '';
}
function orderSql(order, alias = 't') {
  if (!order) return '';
  const parts = order.split(',').map((o) => {
    const [col, ...mods] = o.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : '';
    return `${alias}.${ident(col)} ${dir}${nulls}`;
  });
  return `order by ${parts.join(', ')}`;
}
function castValue(table, col, v) {
  const type = columnTypes.get(table)?.get(col) ?? 'text';
  if (v === null || v === undefined) return { sql: `null::${type}`, value: undefined };
  if (type === 'jsonb' || type === 'json') return { sql: `::${type}`, value: JSON.stringify(v) };
  return { sql: `::${type}`, value: typeof v === 'object' ? JSON.stringify(v) : v };
}

/** JSON qiymatini funksiya argumenti turiga mos PostgreSQL parametriga aylantirish */
function toPgParam(type, v) {
  if (v === null || v === undefined) return null;
  if (type === 'jsonb' || type === 'json') return JSON.stringify(v);
  if (type.endsWith('[]') && Array.isArray(v)) {
    return `{${v.map((x) => `"${String(x).replace(/["\\]/g, '\\$&')}"`).join(',')}}`;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// ---------------------------------------------------------------- HTTP
async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204);

  // ------------------------------ AUTH
  if (path === '/auth/v1/signup' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.email) {
      if (accounts.has(body.email.toLowerCase())) return send(res, 422, { code: 'user_already_exists', msg: 'User already registered' });
      const id = await createUser({ email: body.email, password: body.password });
      return send(res, 200, await sessionFor(id));
    }
    const id = await createUser();
    return send(res, 200, await sessionFor(id));
  }
  if (path === '/auth/v1/token' && req.method === 'POST') {
    const body = await readBody(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const acc = accounts.get(String(body.email ?? '').toLowerCase());
      if (!acc || acc.password !== body.password) {
        return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return send(res, 200, await sessionFor(acc.id));
    }
    if (grant === 'refresh_token') {
      const uid = refreshTokens.get(body.refresh_token);
      if (!uid) return send(res, 400, { error: 'invalid_grant', code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      refreshTokens.delete(body.refresh_token);
      return send(res, 200, await sessionFor(uid));
    }
    return send(res, 400, { msg: 'Unsupported grant' });
  }
  if (path === '/auth/v1/user' && req.method === 'GET') {
    const uid = userFromAuthHeader(req);
    if (!uid) return send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' });
    const u = (await db.query(`select id, email, is_anonymous from auth.users where id = $1`, [uid])).rows[0];
    return u ? send(res, 200, userJson(u)) : send(res, 404, { msg: 'User not found' });
  }
  if (path === '/auth/v1/logout') return send(res, 204);

  // ------------------------------ RPC
  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
  if (rpc && req.method === 'POST') {
    const name = rpc[1];
    const fn = functions.get(name);
    if (!fn || name.startsWith('_')) return send(res, 404, { code: 'PGRST202', message: `Funksiya topilmadi: ${name}` });
    const body = await readBody(req);
    const values = [];
    const unknown = Object.keys(body).find((k) => !fn.names.includes(k));
    if (unknown) return send(res, 404, { code: 'PGRST202', message: `Nomaʼlum argument: ${unknown}` });
    const args = Object.entries(body).map(([k, v]) => {
      const type = fn.types[fn.names.indexOf(k)];
      values.push(toPgParam(type, v));
      return `${ident(k)} => $${values.length}::${type}`;
    });
    const uid = userFromAuthHeader(req);
    const call = `public.${ident(name)}(${args.join(', ')})`;
    try {
      const result = await asUser(uid, async (tx) => {
        if (fn.ret === 'void') {
          await tx.query(`select ${call}`, values);
          return null;
        }
        const r = await tx.query(`select to_jsonb(${call}) as r`, values);
        return r.rows[0]?.r ?? null;
      });
      return send(res, 200, result);
    } catch (e) {
      const { status, body: err } = pgError(e);
      return send(res, status, err);
    }
  }

  // ------------------------------ TABLE
  const tbl = path.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (tbl) {
    const table = tbl[1];
    if (!columnTypes.has(table)) return send(res, 404, { code: '42P01', message: `Jadval topilmadi: ${table}` });
    const uid = userFromAuthHeader(req);
    const params = [...url.searchParams.entries()];
    const select = url.searchParams.get('select');
    const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
    const prefer = req.headers.prefer ?? '';
    try {
      let rows = [];
      if (req.method === 'GET') {
        const values = [];
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');
        const sql = `select ${selectSql(table, select)} from public.${ident(table)} t ${whereSql(params, values)} ${orderSql(url.searchParams.get('order'))}
                     ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`;
        rows = await asUser(uid, async (tx) => (await tx.query(sql, values)).rows);
      } else if (req.method === 'POST') {
        const body = await readBody(req);
        const list = Array.isArray(body) ? body : [body];
        rows = await asUser(uid, async (tx) => {
          const out = [];
          for (const obj of list) {
            const cols = Object.keys(obj);
            const values = [];
            const exprs = cols.map((c) => {
              const { sql, value } = castValue(table, c, obj[c]);
              if (value === undefined) return sql;
              values.push(value);
              return `$${values.length}${sql}`;
            });
            const r = await tx.query(
              `insert into public.${ident(table)} (${cols.map(ident).join(', ')}) values (${exprs.join(', ')}) returning *`,
              values,
            );
            out.push(...r.rows);
          }
          return out;
        });
      } else if (req.method === 'PATCH') {
        const body = await readBody(req);
        const values = [];
        const sets = Object.keys(body).map((c) => {
          const { sql, value } = castValue(table, c, body[c]);
          if (value === undefined) return `${ident(c)} = ${sql}`;
          values.push(value);
          return `${ident(c)} = $${values.length}${sql}`;
        });
        const where = whereSql(params, values, 't');
        rows = await asUser(uid, async (tx) => (await tx.query(`update public.${ident(table)} t set ${sets.join(', ')} ${where} returning t.*`, values)).rows);
      } else if (req.method === 'DELETE') {
        const values = [];
        const where = whereSql(params, values, 't');
        rows = await asUser(uid, async (tx) => (await tx.query(`delete from public.${ident(table)} t ${where} returning t.*`, values)).rows);
      }
      if (req.method !== 'GET' && !prefer.includes('return=representation')) return send(res, 201);
      if (wantsObject) {
        if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/*` });
    } catch (e) {
      const { status, body: err } = pgError(e);
      return send(res, status, err);
    }
  }

  // ------------------------------ STORAGE (rasm yuklash mock rejimda yoʻq)
  if (path.startsWith('/storage/v1/')) {
    return send(res, 501, { message: 'Mock rejimda rasm yuklash ishlamaydi — rasm havolasini kiriting' });
  }

  return send(res, 404, { message: `Topilmadi: ${req.method} ${path}` });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    send(res, 500, { message: String(e?.message ?? e) });
  });
});
// Realtime websocket yoʻq: ulanish yopiladi va ilova soʻrov orqali yangilanishga oʻtadi
server.on('upgrade', (_req, socket) => socket.destroy());
server.listen(PORT, () => {
  console.log(`IT ARENA mock Supabase: http://localhost:${PORT}`);
  console.log(`Oʻqituvchi: ${TEACHER_EMAIL} / ${TEACHER_PASSWORD}`);
});
