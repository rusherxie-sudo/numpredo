import { normalizeGrid, validateGrid, parseSource, sha256 } from './validation.ts';
export interface Statement {
 bind(...values: unknown[]): Statement;
 first<T = Record<string, unknown>>(): Promise<T | null>;
 all<T = Record<string, unknown>>(): Promise<{results: T[]}>;
 run(): Promise<unknown>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
export interface Env {
 PUBLIC_PUZZLES_DB?: Database;
 PUBLIC_PUZZLES_ENABLED?: string;
 PUBLIC_PUZZLES_ADMIN_TOKEN?: string;
 PUBLIC_PUZZLES_RATE_SALT?: string;
 PUBLIC_PUZZLES_RATE_LIMITER?: { limit(options: {key: string}): Promise<{success: boolean}> };
}
type Row = {id: string; grid: string; validation: string; status: string; created_at: string};
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' } });
const error = (code: string, status = 400) => response({error: code}, status);
export async function handlePublicPuzzles(request: Request, env: Env): Promise<Response> {
  try { return await handle(request, env); }
  catch (e) {
    // 不记录题面、令牌或原始请求。数据库故障不影响客户端本地求解。
    if (e instanceof Error && /^(invalid_|confirmation_required)/.test(e.message)) return error(e.message, 422);
    return error('service_unavailable', 503);
  }
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalid_content_type');
  if (Number(request.headers.get('content-length')) > 4096) throw new Error('invalid_body_size');
  // 流式限制，防止无 Content-Length 的请求绕过大小检查。
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); throw new Error('invalid_body_size'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c,offset); offset += c.length; }
  let data: unknown; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('invalid_json'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_json');
  return data as Record<string, unknown>;
}
async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/[/]$/, '').split('/').slice(3);
  const [id, action] = parts;
  if (env.PUBLIC_PUZZLES_ENABLED !== 'true' || !env.PUBLIC_PUZZLES_DB) return error('service_unavailable', 503);
  const db = env.PUBLIC_PUZZLES_DB;
  if (parts.length > 2 || (id && !/^[a-f0-9]{64}$/.test(id))) return error('not_found', 404);
  if (request.method === 'GET') {
    if (action) return error('not_found',404);
    if (!id) {
      const cursor = url.searchParams.get('cursor') || '';
      const [cursorTime,cursorId] = cursor.split('~');
      if (cursor && (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$/.test(cursorTime) || !/^[a-f0-9]{64}$/.test(cursorId) || cursor.split('~').length !== 2)) return error('invalid_cursor');
      const rows = await db.prepare("SELECT id,grid,created_at,status FROM public_puzzles WHERE status='public' AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 21").bind(cursorTime || '9999',cursorTime || '9999',cursorId || '').all<Row>();
      const items = rows.results.slice(0,20).map(r => ({id:r.id,grid:r.grid,createdAt:r.created_at,status:r.status}));
      const last = items.at(-1);
      return response({items,nextCursor: rows.results.length > 20 ? last!.createdAt + '~' + last!.id : null});
    }
    const row = await db.prepare("SELECT * FROM public_puzzles WHERE id=? AND status='public'").bind(id).first<Row>();
    if (!row) return error('not_found',404);
    const sources = await db.prepare("SELECT source_json,source_status FROM public_puzzle_submissions WHERE puzzle_id=? AND status='active' AND source_status='verified' AND source_json IS NOT NULL ORDER BY created_at,id LIMIT 100").bind(id).all<{source_json:string;source_status:string}>();
    return response({id:row.id,grid:row.grid,createdAt:row.created_at,status:row.status,sources:sources.results.map(s => ({...JSON.parse(s.source_json),verification:s.source_status}))});
  }
  if (request.method !== 'POST') return error('method_not_allowed',405);
  if (request.headers.get('origin') !== url.origin) return error('invalid_origin',403);
  // 可注入Workers限流器；Pages默认复用D1原子计数，不依赖不受支持的绑定。
  if (env.PUBLIC_PUZZLES_RATE_LIMITER) {
    if (!(await env.PUBLIC_PUZZLES_RATE_LIMITER.limit({key:request.headers.get('cf-connecting-ip') || 'unknown'})).success) return error('rate_limited',429);
  } else {
    if (!env.PUBLIC_PUZZLES_RATE_SALT || env.PUBLIC_PUZZLES_RATE_SALT.length < 32) return error('service_unavailable',503);
    const window = Math.floor(Date.now()/60000);
    const key = await sha256(env.PUBLIC_PUZZLES_RATE_SALT + ':' + window + ':' + (request.headers.get('cf-connecting-ip') || 'unknown'));
    const allowed = await db.prepare('INSERT INTO public_puzzle_rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<10 RETURNING count').bind(key,window).first();
    await db.prepare('DELETE FROM public_puzzle_rate_limits WHERE window<?').bind(window-1).run();
    if (!allowed) return error('rate_limited',429);
  }
  const data = await body(request);
  const now = new Date().toISOString();
  if (!id) {
    if (data.confirmed !== true || data.noticeVersion !== '2026-11-15') throw new Error('confirmation_required');
    if (!['manual','paste','ocr'].includes(String(data.inputMethod))) throw new Error('invalid_input_method');
    const grid = normalizeGrid(data.grid), source = parseSource(data.source);
    const validation = validateGrid(grid);
    if (!['unique','pending_validation'].includes(validation.status)) return error(validation.status,422);
    const puzzleId = await sha256('standard-9x9:' + grid);
    const submissionId = crypto.randomUUID(), withdrawToken = crypto.randomUUID() + crypto.randomUUID();
    const withdrawHash = await sha256(withdrawToken);
    const result = await db.batch([
      db.prepare("INSERT INTO public_puzzles(id,grid,validation,validation_version,status,created_at,updated_at) VALUES(?,?,?,'bounded-mrv-v1','candidate',?,?) ON CONFLICT(id) DO NOTHING").bind(puzzleId,grid,validation.status,now,now),
      db.prepare("INSERT INTO public_puzzle_submissions(id,puzzle_id,input_method,notice_version,confirmed_at,withdraw_hash,status,source_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,?)").bind(submissionId,puzzleId,data.inputMethod,data.noticeVersion,now,withdrawHash,source ? JSON.stringify(source) : null,now,now),
      db.prepare("INSERT INTO public_puzzle_audit(id,puzzle_id,submission_id,action,reason,created_at) VALUES(?,?,?,'submit','user_submission',?)").bind(crypto.randomUUID(),puzzleId,submissionId,now),
    ]);
    const inserted = (result[0] as {meta?:{changes?:number}}).meta?.changes === 1;
    return response({puzzleId,submissionId,withdrawToken,status:validation.status === 'unique' ? 'candidate' : 'pending_validation',duplicate:!inserted},201);
  }
  if (action === 'withdraw') {
    if (typeof data.submissionId !== 'string' || typeof data.withdrawToken !== 'string' || data.withdrawToken.length > 200) throw new Error('invalid_withdrawal');
    const row = await db.prepare('SELECT id FROM public_puzzle_submissions WHERE id=? AND puzzle_id=? AND withdraw_hash=?').bind(data.submissionId,id,await sha256(data.withdrawToken)).first();
    if (!row) return error('not_found',404);
    // 本次唯一操作标记只在 active -> withdrawn 时生成；所有副作用共用同一事务。
    // 并发请求即使都通过上面的鉴权，后执行的事务也不会重放隐藏或审计。
    const operationId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO public_puzzle_audit(id,puzzle_id,submission_id,action,reason,created_at) SELECT ?,puzzle_id,id,'withdraw','user_withdrawal',? FROM public_puzzle_submissions WHERE id=? AND puzzle_id=? AND status='active' AND withdraw_hash=?").bind(operationId,now,data.submissionId,id,await sha256(data.withdrawToken)),
      db.prepare("UPDATE public_puzzle_submissions SET status='withdrawn',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM public_puzzle_audit WHERE id=?)").bind(now,data.submissionId,operationId),
      // 首次撤回保守隐藏整题；旧令牌重试不会覆盖后续合法重审状态。
      db.prepare("UPDATE public_puzzles SET status='hidden',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM public_puzzle_audit WHERE id=?)").bind(now,id,operationId),
    ]);
    return response({status:'withdrawn'});
  }
  if (action === 'review-source') {
    if (!env.PUBLIC_PUZZLES_ADMIN_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.PUBLIC_PUZZLES_ADMIN_TOKEN) return error('unauthorized',401);
    if (typeof data.submissionId !== 'string' || !['unverified','verified','disputed'].includes(String(data.verification)) || typeof data.reason !== 'string' || !data.reason.trim() || data.reason.length > 500) throw new Error('invalid_source_review');
    const submission = await db.prepare('SELECT id FROM public_puzzle_submissions WHERE id=? AND puzzle_id=? AND source_json IS NOT NULL').bind(data.submissionId,id).first();
    if (!submission) return error('not_found',404);
    await db.batch([
      db.prepare('UPDATE public_puzzle_submissions SET source_status=?,updated_at=? WHERE id=?').bind(data.verification,now,data.submissionId),
      db.prepare("INSERT INTO public_puzzle_audit(id,puzzle_id,submission_id,action,reason,created_at) VALUES(?,?,?,'review_source',?,?)").bind(crypto.randomUUID(),id,data.submissionId,JSON.stringify({verification:data.verification,reason:data.reason}),now),
    ]);
    return response({verification:data.verification});
  }
  if (action === 'moderate') {
    if (!env.PUBLIC_PUZZLES_ADMIN_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.PUBLIC_PUZZLES_ADMIN_TOKEN) return error('unauthorized',401);
    if (!['public','hidden','candidate'].includes(String(data.status)) || typeof data.reason !== 'string' || !data.reason.trim() || data.reason.length > 500) throw new Error('invalid_moderation');
    const row = await db.prepare('SELECT * FROM public_puzzles WHERE id=?').bind(id).first<Row>();
    if (!row) return error('not_found',404);
    if (data.status === 'public') {
      if (row.validation !== 'unique' || data.rightsReviewed !== true || validateGrid(row.grid).status !== 'unique') return error('publication_not_approved',422);
    }
    // 原子检查至少存在有效投稿；最后一次撤回后的题面不能恢复公开。
    await db.batch([
      db.prepare("UPDATE public_puzzles SET status=?,updated_at=? WHERE id=? AND (?!='public' OR EXISTS(SELECT 1 FROM public_puzzle_submissions WHERE puzzle_id=? AND status='active'))").bind(data.status,now,id,data.status,id),
      db.prepare("INSERT INTO public_puzzle_audit(id,puzzle_id,action,reason,created_at) VALUES(?,?,'moderate',?,?)").bind(crypto.randomUUID(),id,JSON.stringify({status:data.status,reason:data.reason,rightsReviewed:data.rightsReviewed === true}),now),
    ]);
    const after = await db.prepare('SELECT status FROM public_puzzles WHERE id=?').bind(id).first<{status:string}>();
    if (after?.status !== data.status) return error('publication_not_approved',409);
    return response({status:data.status});
  }
  return error('not_found',404);
}
