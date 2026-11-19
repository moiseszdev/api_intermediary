import sql from 'mssql';

export type RelatedProduct = { identificador: string; codigosChamada: string[]; nome: string };
export type Relations = { produtosComplementares: RelatedProduct[]; produtosEquivalentes: RelatedProduct[] };

export class RelationsRepository {
  private pool?: Promise<sql.ConnectionPool>;
  constructor(private readonly connectionString: string, private readonly codeTypeId: string) {}
  private getPool() { return this.pool ??= new sql.ConnectionPool(this.connectionString).connect(); }
  async getMany(ids: string[]): Promise<Map<string, Relations>> {
    const out = new Map<string, Relations>(ids.map(id => [id, { produtosComplementares: [], produtosEquivalentes: [] }]));
    if (!ids.length) return out;
    const pool = await this.getPool(); const request = pool.request().input('codeTypeId', sql.VarChar(10), this.codeTypeId);
    const values = ids.map((id, i) => { request.input(`id${i}`, sql.VarChar(10), id); return `(@id${i})`; }).join(',');
    const result = await request.query(`
      WITH Requested(IdProduto) AS (SELECT IdProduto FROM (VALUES ${values}) v(IdProduto)),
      Rel AS (
        SELECT pc.IdProduto Principal, pc.IdProdutoComplementar Relacionado, 'C' Tipo FROM dbo.ProdutoComplementar pc JOIN Requested r ON r.IdProduto=pc.IdProduto
        UNION ALL
        SELECT pe.IdProduto, pe.IdProdutoEquivalente, 'E' FROM dbo.ProdutoEquivalente pe JOIN Requested r ON r.IdProduto=pe.IdProduto
      )
      SELECT DISTINCT rel.Principal, rel.Tipo, p.IdProduto identificador, p.NmProduto nome, cp.CdChamada codigo
      FROM Rel rel JOIN dbo.Produto p ON p.IdProduto=rel.Relacionado
      LEFT JOIN dbo.CodigoProduto cp ON cp.IdProduto=p.IdProduto AND cp.IdTipoCodigoProduto=@codeTypeId
      ORDER BY rel.Principal, rel.Tipo, p.IdProduto`);
    const grouped = new Map<string, RelatedProduct>();
    for (const row of result.recordset) {
      const key = `${row.Principal}|${row.Tipo}|${row.identificador}`;
      let item = grouped.get(key); if (!item) { item = { identificador: row.identificador, nome: row.nome, codigosChamada: [] }; grouped.set(key, item); (row.Tipo === 'C' ? out.get(row.Principal)!.produtosComplementares : out.get(row.Principal)!.produtosEquivalentes).push(item); }
      const codigo = row.codigo == null ? null : String(row.codigo).trimEnd();
      if (codigo && !item.codigosChamada.includes(codigo)) item.codigosChamada.push(codigo);
    }
    return out;
  }
}
