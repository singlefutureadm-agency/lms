package br.com.lms;

import br.com.lms.domain.area.AreaRepository;
import br.com.lms.domain.curso.Aula;
import br.com.lms.domain.curso.AulaRepository;
import br.com.lms.domain.curso.Curso;
import br.com.lms.domain.curso.CursoRepository;
import br.com.lms.domain.curso.Modulo;
import br.com.lms.domain.curso.ModuloRepository;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.matricula.MatriculaRepository;
import br.com.lms.domain.matricula.ProgressoAula;
import br.com.lms.domain.matricula.ProgressoAulaRepository;
import br.com.lms.domain.presenca.PresencaAulaRepository;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.domain.usuario.UsuarioRepository;
import br.com.lms.security.JwtTokenProvider;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

/**
 * Base de testes de integração: sobe um Postgres real via Testcontainers e roda
 * as migrations Flyway reais (o projeto usa features específicas do Postgres, então
 * H2 não é uma opção). O container é iniciado uma única vez em bloco estático
 * (padrão singleton manual) e compartilhado entre todas as subclasses no mesmo
 * processo de teste — o Ryuk do Testcontainers o derruba ao final da JVM. Cada
 * teste roda dentro de uma transação revertida ao final (@Transactional), garantindo
 * isolamento sem depender de ordem de execução.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Transactional
public abstract class IntegrationTestBase {

    // Testcontainers 2.x: os módulos mudaram de pacote (org.testcontainers.postgresql),
    // o self-type genérico foi removido e o construtor com String crua saiu em favor
    // de DockerImageName.
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer(DockerImageName.parse("postgres:18"))
            .withDatabaseName("lmsdb_test")
            .withUsername("lms_test")
            .withPassword("lms_test");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // Habilita as estatísticas do Hibernate para os testes de contagem de query
        // (ver CursoQueryCountIT). Fica no base para todos os ITs compartilharem
        // o mesmo contexto Spring em cache.
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");
    }

    @Autowired protected MockMvc mockMvc;
    @Autowired protected ObjectMapper objectMapper;
    @Autowired protected EntityManager entityManager;

    /**
     * Executa {@code acao} com o contexto de persistência limpo e devolve quantos
     * statements JDBC o Hibernate preparou. Sem o {@code clear()}, entidades já
     * carregadas pelo setup do teste seriam servidas do cache de primeiro nível e
     * a contagem ficaria otimista.
     */
    protected long contarQueries(ThrowingRunnable acao) throws Exception {
        Statistics stats = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        entityManager.flush();
        entityManager.clear();
        stats.clear();
        acao.run();
        return stats.getPrepareStatementCount();
    }

    @FunctionalInterface
    protected interface ThrowingRunnable {
        void run() throws Exception;
    }
    @Autowired protected UsuarioRepository usuarioRepository;
    @Autowired protected AreaRepository areaRepository;
    @Autowired protected CursoRepository cursoRepository;
    @Autowired protected MatriculaRepository matriculaRepository;
    @Autowired protected PresencaAulaRepository presencaAulaRepository;
    @Autowired protected ProgressoAulaRepository progressoAulaRepository;
    @Autowired protected br.com.lms.domain.professor.ProfessorCursoRepository professorCursoRepository;
    @Autowired protected br.com.lms.domain.regiao.RegiaoRepository regiaoRepository;
    @Autowired protected br.com.lms.domain.regiao.UnidadeRepository unidadeRepository;
    @Autowired protected br.com.lms.domain.conteudo.ConteudoAulaRepository conteudoAulaRepository;
    @Autowired protected AulaRepository aulaRepository;
    @Autowired protected ModuloRepository moduloRepository;
    @Autowired protected br.com.lms.domain.notificacao.NotificacaoRepository notificacaoRepository;
    @Autowired protected PasswordEncoder passwordEncoder;
    @Autowired protected JwtTokenProvider tokenProvider;

    protected Usuario criarUsuario(String nome, String email, String senha, Usuario.Role role) {
        Usuario usuario = Usuario.builder()
                .nome(nome)
                .email(email)
                .senha(passwordEncoder.encode(senha))
                .role(role)
                .build();
        return usuarioRepository.save(usuario);
    }

    protected String tokenPara(Usuario usuario) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                usuario, null, usuario.getAuthorities());
        return tokenProvider.generate(auth);
    }

    protected Curso criarCurso(String titulo) {
        var area = areaRepository.findAll().get(0);
        Curso curso = Curso.builder()
                .titulo(titulo)
                .descricao("Descrição de teste")
                .nivel(Curso.Nivel.BASICO)
                .area(area)
                .build();
        return cursoRepository.save(curso);
    }

    protected Aula criarCursoComAula(String tituloCurso) {
        var area = areaRepository.findAll().get(0);
        Curso curso = Curso.builder()
                .titulo(tituloCurso)
                .descricao("Descrição de teste")
                .nivel(Curso.Nivel.BASICO)
                .area(area)
                .build();
        Modulo modulo = Modulo.builder().titulo("Módulo 1").ordem(1).curso(curso).build();
        Aula aula = Aula.builder().titulo("Aula 1").duracaoMin(30).ordem(1).modulo(modulo).build();
        modulo.getAulas().add(aula);
        curso.getModulos().add(modulo);
        curso = cursoRepository.save(curso);
        return curso.getModulos().get(0).getAulas().get(0);
    }

    protected Modulo criarModulo(String tituloCurso) {
        var area = areaRepository.findAll().get(0);
        Curso curso = Curso.builder()
                .titulo(tituloCurso)
                .descricao("Descrição de teste")
                .nivel(Curso.Nivel.BASICO)
                .area(area)
                .build();
        Modulo modulo = Modulo.builder().titulo("Módulo 1").ordem(1).curso(curso).build();
        curso.getModulos().add(modulo);
        curso = cursoRepository.save(curso);
        return curso.getModulos().get(0);
    }

    protected Matricula matricular(Usuario usuario, Curso curso) {
        Matricula matricula = Matricula.builder().usuario(usuario).curso(curso).build();
        return matriculaRepository.save(matricula);
    }

    protected ProgressoAula marcarProgresso(Matricula matricula, Aula aula) {
        ProgressoAula progresso = ProgressoAula.builder()
                .matricula(matricula).aula(aula)
                .concluida(true).concluidoEm(java.time.LocalDateTime.now())
                .build();
        return progressoAulaRepository.save(progresso);
    }

    protected br.com.lms.domain.presenca.PresencaAula registrarPresenca(Matricula matricula, Aula aula) {
        br.com.lms.domain.presenca.PresencaAula presenca = br.com.lms.domain.presenca.PresencaAula.builder()
                .matricula(matricula).aula(aula)
                .presente(true).dataAula(java.time.LocalDate.now())
                .build();
        return presencaAulaRepository.save(presenca);
    }

    protected br.com.lms.domain.notificacao.Notificacao criarNotificacao(Usuario usuario,
            br.com.lms.domain.notificacao.Notificacao.Tipo tipo, String mensagem, boolean lida) {
        var notificacao = br.com.lms.domain.notificacao.Notificacao.builder()
                .usuario(usuario).tipo(tipo).mensagem(mensagem).lida(lida)
                .build();
        return notificacaoRepository.save(notificacao);
    }
}
