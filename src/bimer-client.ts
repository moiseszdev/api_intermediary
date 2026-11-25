import { BusinessError, OriginError } from './errors.ts';
import { retries, tokenRenewals } from './metrics.ts';
import JSONbig from 'json-bigint';

const safeJson = JSONbig({ storeAsString: true });

type Token = { accessToken: string; refreshToken: string; tokenType?: string; expiresIn: number };
type TokenState = Token & { expiresAt: number };
type ClientOptions = { baseUrl: string; username: string; password: string; timeoutMs: number; refreshMarginMs: number; expiresMultiplier: number; fetchFn?: typeof fetch };

export class BimerClient {
  private token?: TokenState;
  private tokenFlight?: Promise<TokenState>;
  private readonly fetchFn: typeof fetch;
  constructor(private readonly o: ClientOptions) { this.fetchFn = o.fetchFn ?? fetch; }

  private form(values: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; }
  private async tokenRequest(path: string, body: FormData): Promise<TokenState> {
    const r = await this.fetchFn(new URL(path, this.o.baseUrl), { method: 'POST', body, signal: AbortSignal.timeout(this.o.timeoutMs) });
    if (!r.ok) throw new OriginError(`Falha de autenticação Bimer (${r.status})`, r.status === 401 || r.status === 400 ? 502 : 503, r.status >= 500);
    const t = safeJson.parse(await r.text()) as Token;
    if (!t.accessToken || !t.refreshToken || !Number.isFinite(t.expiresIn)) throw new OriginError('Resposta de autenticação Bimer inválida');
    return { ...t, expiresAt: Date.now() + t.expiresIn * this.o.expiresMultiplier };
  }
  private login() { tokenRenewals.inc({ method: 'login' }); return this.tokenRequest('/auth/token', this.form({ username: this.o.username, password: this.o.password })); }
  private async refresh(old: TokenState) {
    try {
      tokenRenewals.inc({ method: 'refresh' });
      return await this.tokenRequest('/auth/refresh-token', this.form({ username: this.o.username, token: old.accessToken.replace(/^Bearer\s+/i, ''), refreshToken: old.refreshToken.replace(/^Bearer\s+/i, '') }));
    } catch (e) { if (e instanceof OriginError && !e.transient) return this.login(); throw e; }
  }
  private ensureToken(force = false): Promise<TokenState> {
    if (!force && this.token && Date.now() < this.token.expiresAt - this.o.refreshMarginMs) return Promise.resolve(this.token);
    if (!this.tokenFlight) this.tokenFlight = (this.token ? this.refresh(this.token) : this.login()).then(t => (this.token = t)).finally(() => { this.tokenFlight = undefined; });
    return this.tokenFlight;
  }
  private async raw(path: string, retry401 = true): Promise<unknown> {
    const token = await this.ensureToken();
    const r = await this.fetchFn(new URL(path, this.o.baseUrl), { headers: { authorization: `${token.tokenType || 'Bearer'} ${token.accessToken}` }, signal: AbortSignal.timeout(this.o.timeoutMs) });
    if (r.status === 401 && retry401) { this.token = undefined; await this.ensureToken(true); return this.raw(path, false); }
    if (!r.ok) throw new OriginError(`Falha Bimer (${r.status})`, r.status >= 500 || r.status === 429 ? 503 : 502, r.status >= 500 || r.status === 429);
    const raw = safeJson.parse(await r.text()) as { erros?: unknown[]; listaObjetos?: unknown[]; Erros?: unknown[]; ListaObjetos?: unknown[] };
    const erros = raw.erros ?? raw.Erros;
    const listaObjetos = raw.listaObjetos ?? raw.ListaObjetos;
    if (erros?.length) throw new BusinessError(erros);
    if (!Array.isArray(listaObjetos)) throw new OriginError('Envelope Bimer inválido');
    return { erros: erros ?? [], listaObjetos };
  }
  async getWithRetry(path: string): Promise<any> {
    for (let attempt = 0; ; attempt++) try { return await this.raw(path); } catch (e) {
      if (!(e instanceof OriginError) || !e.transient || attempt >= 2) throw e;
      retries.inc(); await new Promise(r => setTimeout(r, Math.min(2000, 200 * 2 ** attempt) + Math.random() * 100));
    }
  }
  getProduct(id: string) { return this.getWithRetry(`/api/produtos/${encodeURIComponent(id)}`); }
  getProductByCode(code: string) { return this.getWithRetry(`/api/produtos?codigo=${encodeURIComponent(code)}`); }
  getStock(companyCode: number, productId: string, sectorId?: string) {
    const query = sectorId ? `?identificadorSetor=${encodeURIComponent(sectorId)}` : '';
    return this.getWithRetry(`/api/${companyCode}/produtos/${encodeURIComponent(productId)}/estoque${query}`);
  }
  getChanged(cursor: string, limit: number) { return this.getWithRetry(`/api/produtos/versaoRegistro?versaoRegistro=${encodeURIComponent(cursor)}&itensPorPagina=${limit}`); }
}
