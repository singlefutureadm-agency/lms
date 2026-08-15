package br.com.lms.domain.presenca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PresencaAulaRepository extends JpaRepository<PresencaAula, Long> {
    List<PresencaAula> findByMatriculaId(Long matriculaId);

    Optional<PresencaAula> findByMatriculaIdAndAulaIdAndDataAula(Long matriculaId, Long aulaId, LocalDate dataAula);

    @Query("SELECT COUNT(p) FROM PresencaAula p WHERE p.matricula.id = :mid AND p.presente = true")
    long countPresencas(@Param("mid") Long matriculaId);

    @Query("SELECT COUNT(p) FROM PresencaAula p WHERE p.matricula.id = :mid")
    long countTotal(@Param("mid") Long matriculaId);

    boolean existsByAula_IdIn(List<Long> aulaIds);
}
