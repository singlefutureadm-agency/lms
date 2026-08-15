package br.com.lms.domain.notificacao;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificacaoRepository extends JpaRepository<Notificacao, Long> {

    Page<Notificacao> findByUsuario_Id(Long usuarioId, Pageable pageable);

    Page<Notificacao> findByUsuario_IdAndLidaFalse(Long usuarioId, Pageable pageable);

    long countByUsuario_IdAndLidaFalse(Long usuarioId);
}
