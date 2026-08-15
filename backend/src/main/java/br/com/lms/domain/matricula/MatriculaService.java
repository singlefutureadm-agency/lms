package br.com.lms.domain.matricula;

import br.com.lms.domain.curso.Aula;
import br.com.lms.domain.curso.AulaRepository;
import br.com.lms.domain.curso.CursoRepository;
import br.com.lms.domain.notificacao.Notificacao;
import br.com.lms.domain.notificacao.NotificacaoService;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.*;
import br.com.lms.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Regras de matrícula, progresso e avaliação.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MatriculaService {

    /** Nota mínima para aprovação automática. */
    public static final BigDecimal NOTA_APROVACAO = new BigDecimal("6.0");

    private final MatriculaRepository matriculaRepository;
    private final CursoRepository cursoRepository;
    private final ProgressoAulaRepository progressoRepository;
    private final AulaRepository aulaRepository;
    private final NotificacaoService notificacaoService;

    @Transactional(readOnly = true)
    public List<MatriculaResponse> minhas(Long usuarioId) {
        return matriculaRepository.findByUsuarioId(usuarioId)
                .stream().map(MatriculaResponse::from).toList();
    }

    @Transactional
    public MatriculaResponse matricular(Usuario usuario, MatriculaRequest request) {
        if (matriculaRepository.existsByUsuarioIdAndCursoId(usuario.getId(), request.cursoId()))
            throw new IllegalStateException("Você já está matriculado neste curso");
        var curso = cursoRepository.findById(request.cursoId())
                .orElseThrow(() -> new ResourceNotFoundException("Curso", request.cursoId()));
        Matricula matricula = matriculaRepository.save(
                Matricula.builder().usuario(usuario).curso(curso).build());
        notificacaoService.criar(usuario.getId(), Notificacao.Tipo.MATRICULA_CONFIRMADA,
                "Sua matrícula em '" + curso.getTitulo() + "' foi confirmada.", matricula.getId());
        log.info("Matrícula criada: usuario={} curso={}", usuario.getId(), request.cursoId());
        return MatriculaResponse.from(matricula);
    }

    @Transactional(readOnly = true)
    public ProgressoResponse progresso(Long matriculaId) {
        Matricula matricula = buscar(matriculaId);
        long concluidas = matriculaRepository.countAulasConcluidas(matriculaId);
        long total = matriculaRepository.countTotalAulasDoCurso(matricula.getCurso().getId());
        double percentual = total > 0 ? (concluidas * 100.0 / total) : 0;
        return new ProgressoResponse(matriculaId, concluidas, total, percentual);
    }

    @Transactional
    public void marcarAula(MarcarAulaRequest request) {
        Matricula matricula = buscar(request.matriculaId());
        Aula aula = aulaRepository.findById(request.aulaId())
                .orElseThrow(() -> new ResourceNotFoundException("Aula", request.aulaId()));
        ProgressoAula progresso = progressoRepository
                .findByMatriculaIdAndAulaId(request.matriculaId(), request.aulaId())
                .orElseGet(() -> ProgressoAula.builder().matricula(matricula).aula(aula).build());
        progresso.setConcluida(true);
        progresso.setConcluidoEm(LocalDateTime.now());
        progressoRepository.save(progresso);
    }

    @Transactional(readOnly = true)
    public List<MatriculaDetalheResponse> porCurso(Long cursoId) {
        return matriculaRepository.findByCursoId(cursoId)
                .stream().map(MatriculaDetalheResponse::from).toList();
    }

    /** Lança a nota e resolve a aprovação automática (>= 6,0), com auditoria de quem/quando. */
    @Transactional
    public NotaResponse lancarNota(Long matriculaId, NotaRequest request, Usuario professor) {
        Matricula matricula = buscar(matriculaId);
        BigDecimal nota = request.nota();
        matricula.setNota(nota);
        matricula.setAprovado(nota.compareTo(NOTA_APROVACAO) >= 0);
        matricula.setNotaLancadaEm(LocalDateTime.now());
        matricula.setNotaLancadaPor(professor);
        matriculaRepository.save(matricula);
        String mensagem = "Sua nota em '" + matricula.getCurso().getTitulo() + "' foi lançada: " + nota
                + (matricula.getAprovado() ? " (aprovado)" : " (reprovado)");
        notificacaoService.criar(matricula.getUsuario().getId(), Notificacao.Tipo.NOTA_LANCADA,
                mensagem, matricula.getId());
        log.info("Nota lançada: matricula={} nota={} aprovado={} por={}",
                matriculaId, nota, matricula.getAprovado(), professor.getId());
        return new NotaResponse(matricula.getId(), matricula.getNota(),
                matricula.getAprovado(), matricula.getNotaLancadaEm());
    }

    private Matricula buscar(Long id) {
        return matriculaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matrícula", id));
    }
}
