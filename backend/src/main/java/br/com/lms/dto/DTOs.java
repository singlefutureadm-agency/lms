package br.com.lms.dto;

import br.com.lms.domain.area.Area;
import br.com.lms.domain.area.Categoria;
import br.com.lms.domain.area.Tipo;
import br.com.lms.domain.conteudo.ConteudoAula;
import br.com.lms.domain.curso.Aula;
import br.com.lms.domain.curso.Curso;
import br.com.lms.domain.curso.Modulo;
import br.com.lms.domain.marca.ConfiguracaoMarca;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.notificacao.Notificacao;
import br.com.lms.domain.presenca.PresencaAula;
import br.com.lms.domain.regiao.Regiao;
import br.com.lms.domain.regiao.Unidade;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.validation.ValidVideoModulo;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class DTOs {

    @Schema(description = "Credenciais para POST /api/auth/login")
    public record AuthRequest(
        @Schema(description = "E-mail cadastrado", example = "aluno@lms.com") @NotBlank @Email String email,
        @Schema(description = "Senha em texto plano, comparada via BCrypt") @NotBlank String senha
    ) {}

    @Schema(description = "Cadastro de novo usuário (sempre role ALUNO)")
    public record RegisterRequest(
        @Schema(example = "Maria Silva") @NotBlank @Size(max = 150) String nome,
        @Schema(example = "maria@lms.com") @NotBlank @Email @Size(max = 150) String email,
        // Mínimo de 8 caracteres: antes qualquer senha não-vazia passava.
        @Schema(description = "Mínimo de 8 caracteres") @NotBlank @Size(min = 8, max = 100) String senha
    ) {}

    @Schema(description = "Resposta de login/registro: token JWT + dados básicos do usuário")
    public record AuthResponse(
        @Schema(description = "JWT a ser enviado em 'Authorization: Bearer <token>'") String token,
        @Schema(example = "Bearer") String tipo,
        String nome, String email,
        @Schema(example = "ALUNO", allowableValues = {"ADMIN", "PROFESSOR", "ALUNO"}) String role,
        String avatarUrl) {}

    // Os @Size espelham o length das colunas: sem eles, o estouro só aparecia
    // como DataIntegrityViolationException (409) vinda do banco, em vez de 400.
    @Schema(description = "Criação/edição de curso (POST e PUT /api/cursos). No PUT, os módulos "
            + "fazem merge incremental por id: com id atualiza, sem id cria, ausente é removido.")
    public record CursoRequest(
        @Schema(example = "Introdução ao Spring Boot") @NotBlank @Size(max = 200) String titulo,
        String descricao,
        @NotNull Curso.Nivel nivel,
        @Schema(description = "Opcional: restringe o curso a uma unidade") Long unidadeId,
        @NotNull Long areaId,
        // @Valid: sem isso, as constraints de ModuloRequest (@NotBlank titulo,
        // @ValidVideoModulo etc.) nunca rodavam — Bean Validation não desce
        // automaticamente pra dentro de uma List num record aninhado.
        @Valid List<ModuloRequest> modulos, List<Long> categoriaIds, List<Long> tipoIds) {}

    // ---- Áreas, Categorias e Tipos ----

    public record TipoResponse(Long id, String nome, String slug) {
        public static TipoResponse from(Tipo t) {
            return new TipoResponse(t.getId(), t.getNome(), t.getSlug());
        }
    }

    public record CategoriaResponse(Long id, String nome, String slug, String areaNome, String areaSlug) {
        public static CategoriaResponse from(Categoria c) {
            return new CategoriaResponse(c.getId(), c.getNome(), c.getSlug(),
                    c.getArea().getNome(), c.getArea().getSlug());
        }
    }

    public record AreaResponse(Long id, String nome, String slug, List<CategoriaResponse> categorias) {
        public static AreaResponse from(Area a) {
            return new AreaResponse(a.getId(), a.getNome(), a.getSlug(),
                    a.getCategorias().stream().map(CategoriaResponse::from).toList());
        }
    }

    // ---- Cursos ----

    public record CursoResumoResponse(Long id, String titulo, String descricao, Curso.Nivel nivel,
                                       LocalDateTime criadoEm, Long unidadeId, String unidadeNome,
                                       Long areaId, String areaNome,
                                       String imagemUrl,
                                       List<CategoriaResponse> categorias, List<TipoResponse> tipos) {
        public static CursoResumoResponse from(Curso c) {
            return new CursoResumoResponse(
                c.getId(), c.getTitulo(), c.getDescricao(), c.getNivel(), c.getCriadoEm(),
                c.getUnidade() != null ? c.getUnidade().getId() : null,
                c.getUnidade() != null ? c.getUnidade().getNome() : null,
                c.getArea() != null ? c.getArea().getId() : null,
                c.getArea() != null ? c.getArea().getNome() : null,
                c.getImagemUrl(),
                c.getCategorias().stream().map(CategoriaResponse::from).toList(),
                c.getTipos().stream().map(TipoResponse::from).toList()
            );
        }
    }

    public record AulaResponse(Long id, Long moduloId, String titulo, String urlVideo, int duracaoMin, int ordem) {
        public static AulaResponse from(Aula a) {
            return new AulaResponse(a.getId(), a.getModulo() != null ? a.getModulo().getId() : null,
                    a.getTitulo(), a.getUrlVideo(), a.getDuracaoMin(), a.getOrdem());
        }
    }

    @Schema(description = "Criação de aula vinculada a um módulo (POST /api/aulas)")
    public record CriarAulaRequest(
        @NotNull Long moduloId,
        @NotBlank @Size(max = 200) String titulo,
        @Size(max = 500) String urlVideo,
        Integer duracaoMin,
        Integer ordem
    ) {}

    @Schema(description = "Edição de aula (PUT /api/aulas/{id})")
    public record AtualizarAulaRequest(
        @NotBlank @Size(max = 200) String titulo,
        @Size(max = 500) String urlVideo,
        Integer duracaoMin,
        Integer ordem
    ) {}

    public record ModuloResponse(Long id, String titulo, int ordem, String urlVideo,
                                  Modulo.TipoVideo tipoVideo, List<AulaResponse> aulas) {
        public static ModuloResponse from(Modulo m) {
            return new ModuloResponse(m.getId(), m.getTitulo(), m.getOrdem(), m.getUrlVideo(), m.getTipoVideo(),
                    m.getAulas().stream().map(AulaResponse::from).toList());
        }
    }

    @Schema(description = "Módulo dentro de CursoRequest.modulos: id presente = atualiza módulo "
            + "existente; id nulo = cria módulo novo")
    @ValidVideoModulo
    public record ModuloRequest(
        @Schema(description = "Nulo para criar; id de um módulo existente do curso para atualizar") Long id,
        @NotBlank @Size(max = 200) String titulo,
        @NotNull Integer ordem,
        @Schema(description = "URL do vídeo do módulo: arquivo (upload via "
                + "/api/upload/modulo/{id}/video) ou link de YouTube/Vimeo (validado contra "
                + "tipoVideo). Nulo num módulo que já tinha vídeo salvo é tratado como remoção "
                + "explícita: o arquivo local, se houver, é apagado do disco.")
        @Size(max = 500) String urlVideo,
        @Schema(description = "ARQUIVO = upload local; YOUTUBE/VIMEO = link externo, com "
                + "urlVideo validada contra o padrão do respectivo serviço; nulo = sem vídeo")
        Modulo.TipoVideo tipoVideo) {}

    public record CursoDetalheResponse(Long id, String titulo, String descricao, Curso.Nivel nivel,
                                       LocalDateTime criadoEm, Long unidadeId, String unidadeNome,
                                       Long areaId, String areaNome,
                                       String imagemUrl,
                                       List<CategoriaResponse> categorias, List<TipoResponse> tipos,
                                       List<ModuloResponse> modulos) {
        public static CursoDetalheResponse from(Curso c) {
            return new CursoDetalheResponse(
                c.getId(), c.getTitulo(), c.getDescricao(), c.getNivel(), c.getCriadoEm(),
                c.getUnidade() != null ? c.getUnidade().getId() : null,
                c.getUnidade() != null ? c.getUnidade().getNome() : null,
                c.getArea() != null ? c.getArea().getId() : null,
                c.getArea() != null ? c.getArea().getNome() : null,
                c.getImagemUrl(),
                c.getCategorias().stream().map(CategoriaResponse::from).toList(),
                c.getTipos().stream().map(TipoResponse::from).toList(),
                c.getModulos().stream().map(ModuloResponse::from).toList()
            );
        }
    }

    @Schema(description = "Matricula o usuário autenticado num curso (POST /api/matriculas)")
    public record MatriculaRequest(@NotNull Long cursoId) {}

    public record MatriculaResponse(Long id, Long cursoId, String cursoTitulo,
                                    @Schema(example = "EM_ANDAMENTO") Matricula.Status status,
                                    LocalDateTime matriculadoEm) {
        public static MatriculaResponse from(Matricula m) {
            return new MatriculaResponse(m.getId(), m.getCurso().getId(), m.getCurso().getTitulo(),
                    m.getStatus(), m.getMatriculadoEm());
        }
    }

    public record ProgressoResponse(Long matriculaId, long aulasConcluidas, long totalAulas, double percentual) {}

    @Schema(description = "Marca uma aula como concluída para a matrícula (POST /api/matriculas/progresso)")
    public record MarcarAulaRequest(@NotNull Long matriculaId, @NotNull Long aulaId) {}

    public record UsuarioResponse(Long id, String nome, String email, Usuario.Role role, Long unidadeId, String unidadeNome, String avatarUrl) {
        public static UsuarioResponse from(Usuario u) {
            return new UsuarioResponse(u.getId(), u.getNome(), u.getEmail(), u.getRole(),
                u.getUnidade() != null ? u.getUnidade().getId() : null,
                u.getUnidade() != null ? u.getUnidade().getNome() : null,
                u.getAvatarUrl());
        }
    }

    public record RegiaoRequest(@NotBlank @Size(max = 100) String nome) {}

    public record RegiaoResponse(Long id, String nome, int totalUnidades) {
        public static RegiaoResponse from(Regiao r) {
            return new RegiaoResponse(r.getId(), r.getNome(), r.getUnidades().size());
        }
    }

    public record UnidadeRequest(@NotBlank @Size(max = 150) String nome,
                                 @Size(max = 300) String endereco, @NotNull Long regiaoId) {}

    public record UnidadeResponse(Long id, String nome, String slug, String endereco, Long regiaoId, String regiaoNome, String imagemUrl) {
        public static UnidadeResponse from(Unidade u) {
            return new UnidadeResponse(u.getId(), u.getNome(), u.getSlug(), u.getEndereco(),
                u.getRegiao().getId(), u.getRegiao().getNome(), u.getImagemUrl());
        }
    }

    public record UnidadeDetalheResponse(Long id, String nome, String slug, String regiaoNome,
                                          List<AreaResponse> areas, List<TipoResponse> tipos) {
        public static UnidadeDetalheResponse from(Unidade u, List<Area> areas, List<Tipo> tipos) {
            return new UnidadeDetalheResponse(u.getId(), u.getNome(), u.getSlug(),
                u.getRegiao().getNome(),
                areas.stream().map(AreaResponse::from).toList(),
                tipos.stream().map(TipoResponse::from).toList());
        }
    }

    public record ConteudoAulaRequest(
        @NotBlank @Size(max = 200) String titulo,
        @NotNull ConteudoAula.TipoConteudo tipo,
        String conteudo,
        Integer ordem
    ) {}

    public record ConteudoAulaResponse(
        Long id, String titulo,
        ConteudoAula.TipoConteudo tipo,
        String conteudo, int ordem
    ) {
        public static ConteudoAulaResponse from(ConteudoAula c) {
            return new ConteudoAulaResponse(c.getId(), c.getTitulo(),
                c.getTipo(), c.getConteudo(), c.getOrdem());
        }
    }

    public record PresencaRequest(
        @NotNull Long matriculaId,
        @NotNull Long aulaId,
        @NotNull Boolean presente,
        @NotNull LocalDate dataAula
    ) {}

    public record PresencaResponse(
        Long id, Long matriculaId, Long aulaId,
        boolean presente, LocalDate dataAula
    ) {
        public static PresencaResponse from(PresencaAula p) {
            return new PresencaResponse(p.getId(), p.getMatricula().getId(),
                p.getAula().getId(), p.getPresente(), p.getDataAula());
        }
    }

    public record PresencaResumoResponse(
        Long matriculaId, long presencas, long totalAulas, double percentual
    ) {}

    /**
     * A coluna é {@code numeric(4,2)} e a aprovação automática compara com 6,0.
     * Sem os limites, uma nota como 99,99 ou negativa era aceita e só a coluna
     * barrava valores fora de escala.
     */
    @Schema(description = "Lançamento de nota (PATCH /api/matriculas/{id}/nota). "
            + "Aprovação automática quando nota >= 6,0.")
    public record NotaRequest(
        @Schema(example = "7.5") @NotNull @DecimalMin("0.0") @DecimalMax("10.0") BigDecimal nota
    ) {}

    public record NotaResponse(
        Long matriculaId, BigDecimal nota,
        boolean aprovado, LocalDateTime lancadaEm
    ) {}

    public record UsuarioUpdateRequest(
        @NotBlank @Size(max = 150) String nome,
        @NotBlank @Email @Size(max = 150) String email,
        @NotNull Usuario.Role role,
        Long unidadeId
    ) {}

    /**
     * Substitui o {@code Map<String,String>} que o PATCH /role recebia. Com o Map,
     * uma role inválida caía num if silencioso e a resposta era 200 com o usuário
     * inalterado; agora o enum é desserializado e validado, então vira 400.
     */
    public record RoleUpdateRequest(@NotNull Usuario.Role role) {}

    /**
     * Substitui o {@code Map<String,Long>} do vínculo professor↔curso, que
     * lançava NPE quando {@code cursoId} vinha ausente.
     */
    public record VincularCursoRequest(@NotNull Long cursoId) {}

    public record MatriculaDetalheResponse(
        Long id, Long usuarioId, String usuarioNome, String usuarioEmail,
        Matricula.Status status, LocalDateTime matriculadoEm,
        BigDecimal nota, Boolean aprovado, LocalDateTime notaLancadaEm
    ) {
        public static MatriculaDetalheResponse from(Matricula m) {
            return new MatriculaDetalheResponse(
                m.getId(), m.getUsuario().getId(),
                m.getUsuario().getNome(), m.getUsuario().getEmail(),
                m.getStatus(), m.getMatriculadoEm(),
                m.getNota(), m.getAprovado(), m.getNotaLancadaEm()
            );
        }
    }

    @Schema(description = "Notificação in-app do usuário (GET /api/notificacoes)")
    public record NotificacaoResponse(
        Long id,
        @Schema(example = "NOTA_LANCADA") Notificacao.Tipo tipo,
        String mensagem, Long referenciaId, boolean lida, LocalDateTime criadoEm
    ) {
        public static NotificacaoResponse from(Notificacao n) {
            return new NotificacaoResponse(n.getId(), n.getTipo(), n.getMensagem(),
                    n.getReferenciaId(), n.getLida(), n.getCriadoEm());
        }
    }

    @Schema(description = "Contagem de notificações não lidas, para alimentar o badge sem paginar tudo")
    public record ContagemNaoLidasResponse(long total) {}

    // ---- Marca (white-label) ----

    @Schema(description = "Aparência da instalação (GET /api/marca — público). "
            + "tema nulo = padrão de fábrica do produto")
    public record MarcaResponse(String nome, String assinatura, String logoUrl, String logoInversoUrl,
                                TemaDTO tema) {
        public static MarcaResponse from(ConfiguracaoMarca m, TemaDTO tema) {
            return new MarcaResponse(m.getNome(), m.getAssinatura(), m.getLogoUrl(), m.getLogoInversoUrl(), tema);
        }
    }

    @Schema(description = "Edição da identidade visual (PUT /api/marca — ADMIN). "
            + "Os logotipos NÃO entram aqui: são multipart, em /api/marca/logo")
    public record MarcaRequest(
        @NotBlank @Size(max = 60) String nome,
        @Size(max = 90) String assinatura
    ) {}

    // ---- Tema (paleta e tipografia da instalação) ----

    /**
     * Formato de cor aceito. A validação não é cosmética: estes valores são
     * escritos pelo frontend em custom properties CSS (`style.setProperty`), e
     * uma string livre permitiria injetar declarações extras. Restringir a
     * #rrggbb fecha isso na entrada.
     */
    private static final String HEX = "^#[0-9A-Fa-f]{6}$";

    @Schema(description = "Paleta de um modo. Todos os tokens são obrigatórios: "
            + "um token ausente deixaria parte da interface sem cor definida")
    public record PaletaDTO(
        @NotBlank @Pattern(regexp = HEX) String marca,
        @NotBlank @Pattern(regexp = HEX) String marcaEscura,
        @NotBlank @Pattern(regexp = HEX) String marcaProfunda,
        @NotBlank @Pattern(regexp = HEX) String marcaSuave,
        @NotBlank @Pattern(regexp = HEX) String destaque,
        @NotBlank @Pattern(regexp = HEX) String fundo,
        @NotBlank @Pattern(regexp = HEX) String superficie,
        @NotBlank @Pattern(regexp = HEX) String superficie2,
        @NotBlank @Pattern(regexp = HEX) String texto,
        @NotBlank @Pattern(regexp = HEX) String textoSuave,
        @NotBlank @Pattern(regexp = HEX) String borda,
        @NotBlank @Pattern(regexp = HEX) String sucesso,
        @NotBlank @Pattern(regexp = HEX) String erro,
        @NotBlank @Pattern(regexp = HEX) String aviso
    ) {}

    @Schema(description = "Tipografia de um modo")
    public record TipografiaDTO(
        @NotBlank @Size(max = 200) String fonteTitulo,
        @NotBlank @Size(max = 200) String fonteCorpo,
        @NotNull @DecimalMin("0.75") @DecimalMax("1.5") Double escala,
        @NotNull @Min(100) @Max(900) Integer pesoTitulo
    ) {}

    public record TemaModoDTO(@NotNull @Valid PaletaDTO cores, @NotNull @Valid TipografiaDTO tipografia) {}

    @Schema(description = "Paleta e tipografia dos dois modos (PUT /api/marca/tema — ADMIN). "
            + "O modo ativo não entra: é preferência de cada usuário, guardada no navegador")
    public record TemaDTO(@NotNull @Valid TemaModoDTO claro, @NotNull @Valid TemaModoDTO escuro) {}
}
