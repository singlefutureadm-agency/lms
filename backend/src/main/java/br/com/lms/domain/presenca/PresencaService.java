package br.com.lms.domain.presenca;

import br.com.lms.domain.curso.Aula;
import br.com.lms.domain.curso.AulaRepository;
import br.com.lms.domain.matricula.Matricula;
import br.com.lms.domain.matricula.MatriculaRepository;
import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.*;
import br.com.lms.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Registro de presença por aula/data.
 *
 * <p>O registro é um upsert sobre a chave (matricula, aula, dataAula). A corrida
 * entre o read e o write é resolvida pela UNIQUE do banco, que o
 * GlobalExceptionHandler traduz em 409.
 */
@Service
@RequiredArgsConstructor
public class PresencaService {

    private final PresencaAulaRepository presencaRepository;
    private final MatriculaRepository matriculaRepository;
    private final AulaRepository aulaRepository;

    @Transactional
    public PresencaResponse registrar(PresencaRequest request, Usuario registradoPor) {
        Matricula matricula = matriculaRepository.findById(request.matriculaId())
                .orElseThrow(() -> new ResourceNotFoundException("Matrícula", request.matriculaId()));
        Aula aula = aulaRepository.findById(request.aulaId())
                .orElseThrow(() -> new ResourceNotFoundException("Aula", request.aulaId()));

        PresencaAula presenca = presencaRepository
                .findByMatriculaIdAndAulaIdAndDataAula(request.matriculaId(), request.aulaId(), request.dataAula())
                .orElseGet(() -> PresencaAula.builder()
                        .matricula(matricula)
                        .aula(aula)
                        .dataAula(request.dataAula())
                        .registradoPor(registradoPor)
                        .build());

        presenca.setPresente(request.presente());
        return PresencaResponse.from(presencaRepository.save(presenca));
    }

    @Transactional(readOnly = true)
    public List<PresencaResponse> porMatricula(Long matriculaId) {
        return presencaRepository.findByMatriculaId(matriculaId)
                .stream().map(PresencaResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PresencaResumoResponse resumo(Long matriculaId) {
        long presencas = presencaRepository.countPresencas(matriculaId);
        long total = presencaRepository.countTotal(matriculaId);
        double percentual = total > 0 ? (presencas * 100.0 / total) : 0;
        return new PresencaResumoResponse(matriculaId, presencas, total, percentual);
    }
}
