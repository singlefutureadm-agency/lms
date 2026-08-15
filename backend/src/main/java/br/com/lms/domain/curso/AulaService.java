package br.com.lms.domain.curso;

import br.com.lms.domain.matricula.ProgressoAulaRepository;
import br.com.lms.domain.presenca.PresencaAulaRepository;
import br.com.lms.dto.DTOs.*;
import br.com.lms.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * CRUD de aula, independente do merge incremental de módulos feito por
 * {@link CursoService#atualizar}. Exclusão segue a mesma regra de
 * {@code CursoService.mergeModulos}: aula com progresso ou presença de aluno
 * registrados não pode ser removida, pra não apagar histórico do aluno.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AulaService {

    private final AulaRepository aulaRepository;
    private final ModuloRepository moduloRepository;
    private final ProgressoAulaRepository progressoAulaRepository;
    private final PresencaAulaRepository presencaAulaRepository;

    @Transactional(readOnly = true)
    public AulaResponse buscarPorId(Long id) {
        return AulaResponse.from(buscar(id));
    }

    @Transactional
    public AulaResponse criar(CriarAulaRequest request) {
        Modulo modulo = moduloRepository.findById(request.moduloId())
                .orElseThrow(() -> new ResourceNotFoundException("Módulo", request.moduloId()));

        Aula aula = Aula.builder()
                .modulo(modulo)
                .titulo(request.titulo())
                .urlVideo(request.urlVideo())
                .duracaoMin(request.duracaoMin() != null ? request.duracaoMin() : 0)
                .ordem(request.ordem() != null ? request.ordem() : 0)
                .build();
        aula = aulaRepository.save(aula);

        log.info("Aula criada: id={} modulo={}", aula.getId(), modulo.getId());
        return AulaResponse.from(aula);
    }

    @Transactional
    public AulaResponse atualizar(Long id, AtualizarAulaRequest request) {
        Aula aula = buscar(id);
        aula.setTitulo(request.titulo());
        aula.setUrlVideo(request.urlVideo());
        if (request.duracaoMin() != null) aula.setDuracaoMin(request.duracaoMin());
        if (request.ordem() != null) aula.setOrdem(request.ordem());

        aula = aulaRepository.save(aula);
        log.info("Aula atualizada: id={}", id);
        return AulaResponse.from(aula);
    }

    @Transactional
    public void excluir(Long id) {
        Aula aula = buscar(id);
        List<Long> aulaId = List.of(id);
        if (progressoAulaRepository.existsByAula_IdIn(aulaId)
                || presencaAulaRepository.existsByAula_IdIn(aulaId)) {
            throw new IllegalStateException(
                    "A aula '" + aula.getTitulo() + "' não pode ser removida: "
                    + "há progresso ou presença de aluno registrados nela");
        }
        aulaRepository.delete(aula);
        log.info("Aula excluída: id={}", id);
    }

    private Aula buscar(Long id) {
        return aulaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Aula", id));
    }
}
