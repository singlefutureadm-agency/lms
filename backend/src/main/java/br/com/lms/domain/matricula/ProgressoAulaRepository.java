package br.com.lms.domain.matricula;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgressoAulaRepository extends JpaRepository<ProgressoAula, Long> {
    Optional<ProgressoAula> findByMatriculaIdAndAulaId(Long matriculaId, Long aulaId);

    boolean existsByAula_IdIn(List<Long> aulaIds);
}
