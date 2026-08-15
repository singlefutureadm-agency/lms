package br.com.lms.domain.curso;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Os métodos de listagem carregam {@code unidade} e {@code area} por
 * {@code @EntityGraph}: são associações *-to-one, então viram JOIN na própria
 * query sem multiplicar linhas nem quebrar a paginação. As coleções
 * ({@code categorias}, {@code tipos}) ficam de fora do grafo de propósito —
 * fetch join de coleção com Pageable força o Hibernate a paginar em memória.
 * Elas são resolvidas pelo {@code hibernate.default_batch_fetch_size}, que
 * agrupa a carga de todos os cursos da página em poucos selects.
 */
public interface CursoRepository extends JpaRepository<Curso, Long> {

    @EntityGraph(attributePaths = {"unidade", "area"})
    Page<Curso> findByAtivoTrue(Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    Page<Curso> findByAtivoTrueAndNivel(Curso.Nivel nivel, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    Page<Curso> findByAtivoTrueAndUnidade_Id(Long unidadeId, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    Page<Curso> findByAtivoTrueAndNivelAndUnidade_Id(Curso.Nivel nivel, Long unidadeId, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    @Query(value = "SELECT c FROM Curso c WHERE c.ativo = true AND c.area.slug = :areaSlug",
           countQuery = "SELECT COUNT(c) FROM Curso c WHERE c.ativo = true AND c.area.slug = :areaSlug")
    Page<Curso> findByAreaSlug(@Param("areaSlug") String areaSlug, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    @Query(value = "SELECT DISTINCT c FROM Curso c JOIN c.categorias cat WHERE c.ativo = true AND cat.area.slug = :areaSlug AND cat.slug = :categoriaSlug",
           countQuery = "SELECT COUNT(DISTINCT c) FROM Curso c JOIN c.categorias cat WHERE c.ativo = true AND cat.area.slug = :areaSlug AND cat.slug = :categoriaSlug")
    Page<Curso> findByCategoriaSlug(@Param("areaSlug") String areaSlug, @Param("categoriaSlug") String categoriaSlug, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    @Query(value = "SELECT DISTINCT c FROM Curso c JOIN c.tipos t WHERE c.ativo = true AND t.slug = :tipoSlug",
           countQuery = "SELECT COUNT(DISTINCT c) FROM Curso c JOIN c.tipos t WHERE c.ativo = true AND t.slug = :tipoSlug")
    Page<Curso> findByTipoSlug(@Param("tipoSlug") String tipoSlug, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    @Query(value = "SELECT DISTINCT c FROM Curso c JOIN c.tipos t WHERE c.ativo = true AND c.unidade.id = :unidadeId AND t.slug = :tipoSlug",
           countQuery = "SELECT COUNT(DISTINCT c) FROM Curso c JOIN c.tipos t WHERE c.ativo = true AND c.unidade.id = :unidadeId AND t.slug = :tipoSlug")
    Page<Curso> findByUnidadeAndTipo(@Param("unidadeId") Long unidadeId, @Param("tipoSlug") String tipoSlug, Pageable pageable);

    @EntityGraph(attributePaths = {"unidade", "area"})
    @Query(value = "SELECT c FROM Curso c WHERE c.ativo = true AND c.unidade.id = :unidadeId AND c.area.slug = :areaSlug",
           countQuery = "SELECT COUNT(c) FROM Curso c WHERE c.ativo = true AND c.unidade.id = :unidadeId AND c.area.slug = :areaSlug")
    Page<Curso> findByUnidadeAndArea(@Param("unidadeId") Long unidadeId, @Param("areaSlug") String areaSlug, Pageable pageable);

    /**
     * Detalhe: o grafo inclui os módulos, mas <b>não</b> {@code modulos.aulas}.
     * Buscar as duas coleções no mesmo grafo dispara
     * {@code MultipleBagFetchException} — o Hibernate não fetcha dois bags
     * (coleções {@code List} sem índice) na mesma query. As aulas são resolvidas
     * pelo {@code default_batch_fetch_size} num único select adicional.
     */
    @EntityGraph(attributePaths = {"unidade", "area", "modulos"})
    @Query("SELECT c FROM Curso c WHERE c.id = :id")
    java.util.Optional<Curso> findDetalheById(@Param("id") Long id);

    /**
     * Busca textual por relevância (título pesa mais que descrição — ver
     * {@code busca_tsv} na V18) combinável com os demais filtros do catálogo.
     * {@code plainto_tsquery} normaliza o termo do usuário em lexemas ligados por
     * AND — ao contrário de {@code to_tsquery}, não interpreta operadores
     * ({@code & | ! ( )}) no texto de entrada, então não quebra com sintaxe
     * inválida.
     *
     * <p>Nativa (não JPQL) porque {@code @@} e {@code ts_rank} são funções do
     * Postgres sem equivalente em JPQL. Os filtros opcionais usam
     * {@code (:param IS NULL OR ...)} em vez de montar a query em Java, e os
     * vínculos N:N (categoria/tipo) usam {@code EXISTS} — não JOIN — pra não
     * multiplicar linhas e exigir DISTINCT (que o Postgres proíbe combinar com
     * ORDER BY por uma expressão fora da lista de SELECT).
     *
     * <p>O {@link Pageable} passado por quem chama não deve carregar Sort: a
     * ordenação por relevância já vem no ORDER BY da query, e Spring Data
     * aplicaria o Sort como identificador SQL cru numa native query.
     */
    @Query(value = """
            SELECT c.* FROM cursos c
            JOIN areas ar ON ar.id = c.area_id
            WHERE c.ativo = true
              AND c.busca_tsv @@ plainto_tsquery('portuguese', :q)
              AND (:nivel IS NULL OR c.nivel = :nivel)
              AND (:unidadeId IS NULL OR c.unidade_id = :unidadeId)
              AND (:areaSlug IS NULL OR ar.slug = :areaSlug)
              AND (:categoriaSlug IS NULL OR EXISTS (
                    SELECT 1 FROM curso_categorias cc JOIN categorias cat ON cat.id = cc.categoria_id
                    WHERE cc.curso_id = c.id AND cat.slug = :categoriaSlug))
              AND (:tipoSlug IS NULL OR EXISTS (
                    SELECT 1 FROM curso_tipos ct JOIN tipos t ON t.id = ct.tipo_id
                    WHERE ct.curso_id = c.id AND t.slug = :tipoSlug))
            ORDER BY ts_rank(c.busca_tsv, plainto_tsquery('portuguese', :q)) DESC
            """,
           countQuery = """
            SELECT COUNT(*) FROM cursos c
            JOIN areas ar ON ar.id = c.area_id
            WHERE c.ativo = true
              AND c.busca_tsv @@ plainto_tsquery('portuguese', :q)
              AND (:nivel IS NULL OR c.nivel = :nivel)
              AND (:unidadeId IS NULL OR c.unidade_id = :unidadeId)
              AND (:areaSlug IS NULL OR ar.slug = :areaSlug)
              AND (:categoriaSlug IS NULL OR EXISTS (
                    SELECT 1 FROM curso_categorias cc JOIN categorias cat ON cat.id = cc.categoria_id
                    WHERE cc.curso_id = c.id AND cat.slug = :categoriaSlug))
              AND (:tipoSlug IS NULL OR EXISTS (
                    SELECT 1 FROM curso_tipos ct JOIN tipos t ON t.id = ct.tipo_id
                    WHERE ct.curso_id = c.id AND t.slug = :tipoSlug))
            """,
           nativeQuery = true)
    Page<Curso> buscarPorTexto(@Param("q") String q, @Param("nivel") String nivel,
            @Param("unidadeId") Long unidadeId, @Param("areaSlug") String areaSlug,
            @Param("categoriaSlug") String categoriaSlug, @Param("tipoSlug") String tipoSlug,
            Pageable pageable);
}
