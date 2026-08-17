package br.com.lms.domain.marca;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /**
     * Paleta e tipografia dos dois modos, serializadas como JSON (coluna
     * {@code jsonb}). Fica como String e não como objeto mapeado: a
     * (de)serialização é feita no service com o ObjectMapper da aplicação, o que
     * mantém o contrato sob controle do DTO validado em vez de depender da
     * integração JSON do Hibernate.
     *
     * <p>{@code null} significa "nunca customizado" — o frontend aplica o padrão
     * de fábrica do produto.
     *
     * <p>{@code @JdbcTypeCode(SqlTypes.JSON)} é obrigatório: sem ele o Hibernate
     * envia a String como {@code varchar} e o Postgres recusa a atribuição a uma
     * coluna {@code jsonb} ("column is of type jsonb but expression is of type
     * character varying"). Não é detalhe cosmético — quebra toda escrita.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tema", columnDefinition = "jsonb")
    private String tema;

    @Column(name = "atualizado_em", nullable = false)
    private LocalDateTime atualizadoEm;

    @PreUpdate
    @PrePersist
    void aoSalvar() {
        atualizadoEm = LocalDateTime.now();
    }
}
