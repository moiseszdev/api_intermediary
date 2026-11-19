-- Referência da consulta usada por src/relations.ts. @ids é expandido apenas em
-- placeholders parametrizados (@id0, @id1, ...); nunca recebe texto concatenado.
WITH Requested(IdProduto) AS (SELECT IdProduto FROM (VALUES (@id0)) v(IdProduto)),
Rel AS (
  SELECT pc.IdProduto Principal, pc.IdProdutoComplementar Relacionado, 'C' Tipo
  FROM dbo.ProdutoComplementar pc JOIN Requested r ON r.IdProduto=pc.IdProduto
  UNION ALL
  SELECT pe.IdProduto, pe.IdProdutoEquivalente, 'E'
  FROM dbo.ProdutoEquivalente pe JOIN Requested r ON r.IdProduto=pe.IdProduto
)
SELECT DISTINCT rel.Principal, rel.Tipo, p.IdProduto identificador,
       p.NmProduto nome, cp.CdChamada codigo
FROM Rel rel
JOIN dbo.Produto p ON p.IdProduto=rel.Relacionado
LEFT JOIN dbo.CodigoProduto cp
  ON cp.IdProduto=p.IdProduto AND cp.IdTipoCodigoProduto=@codeTypeId;
