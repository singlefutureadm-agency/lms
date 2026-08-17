package br.com.lms.domain.marca;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Identidade visual da instalação: nome do cliente, assinatura e logotipos.
 *
 * <p>Linha única, id fixo em {@link #ID} — ver a constraint em
 * {@code V22__create_configuracao_marca.sql}. O id não é gerado: a linha já
 * existe desde a migration, então o fluxo é sempre "carrega e atualiza", nunca
 * "cria".
 */
@Entity
@Table(name = "configuracao_marca")
@Getter
@Setter
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder @NoArgsConstructor @AllArgsConstructor
public class ConfiguracaoMarca {

    /** Id da única linha válida da tabela. */
    public static final long ID = 1L;

    @Id
    @EqualsAndHashCode.Include
    private Long id;

    @Column(nullable = false, length = 60)
    private String nome;

    @Column(length = 90)
    private String assinatura;

    /** Logotipo para fundos claros (site público). */
    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    /** Logotipo para fundos escuros / cor da marca (barra do sistema, login). */
    @Column(name = "logo_inverso_url", length = 500)
    private String logoInversoUrl;

    @Column(name = "atualizado_em", nullable = false)
    private LocalDateTime atualizadoEm;

    @PreUpdate
    @PrePersist
    void aoSalvar() {
        atualizadoEm = LocalDateTime.now();
    }
}
