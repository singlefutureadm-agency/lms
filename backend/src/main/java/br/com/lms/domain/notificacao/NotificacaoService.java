package br.com.lms.domain.notificacao;

import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.*;
import br.com.lms.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notificações in-app simples via polling (sem WebSocket/infra de eventos
 * nova). {@link #criar} é interna — chamada de dentro da mesma transação de
 * quem originou o evento (nota lançada, matrícula confirmada), nunca exposta
 * via API.
 */
@Service
@RequiredArgsConstructor
public class NotificacaoService {

    private final NotificacaoRepository notificacaoRepository;
    private final EntityManager em;

    /**
     * {@code em.getReference} em vez de buscar o usuário: quem chama sempre já
     * validou o id (é o autenticado se matriculando, ou o dono de uma matrícula
     * já persistida), então basta a referência para o FK — sem SELECT extra.
     */
    @Transactional
    public void criar(Long usuarioId, Notificacao.Tipo tipo, String mensagem, Long referenciaId) {
        Usuario usuario = em.getReference(Usuario.class, usuarioId);
        Notificacao notificacao = Notificacao.builder()
                .usuario(usuario)
                .tipo(tipo)
                .mensagem(mensagem)
                .referenciaId(referenciaId)
                .build();
        notificacaoRepository.save(notificacao);
    }

    @Transactional(readOnly = true)
    public Page<NotificacaoResponse> listar(Long usuarioId, boolean apenasNaoLidas, Pageable pageable) {
        Page<Notificacao> page = apenasNaoLidas
                ? notificacaoRepository.findByUsuario_IdAndLidaFalse(usuarioId, pageable)
                : notificacaoRepository.findByUsuario_Id(usuarioId, pageable);
        return page.map(NotificacaoResponse::from);
    }

    @Transactional(readOnly = true)
    public long contarNaoLidas(Long usuarioId) {
        return notificacaoRepository.countByUsuario_IdAndLidaFalse(usuarioId);
    }

    @Transactional
    public void marcarComoLida(Long notificacaoId, Long usuarioId) {
        Notificacao notificacao = notificacaoRepository.findById(notificacaoId)
                .orElseThrow(() -> new ResourceNotFoundException("Notificação", notificacaoId));
        if (!notificacao.getUsuario().getId().equals(usuarioId)) {
            throw new AccessDeniedException("Notificação não pertence ao usuário autenticado");
        }
        notificacao.setLida(true);
        notificacaoRepository.save(notificacao);
    }
}
