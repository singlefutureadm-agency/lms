package br.com.lms.domain.marca;

import br.com.lms.config.CacheConfig;
import br.com.lms.domain.upload.UploadService;
import br.com.lms.dto.DTOs.MarcaRequest;
import br.com.lms.dto.DTOs.MarcaResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Leitura e escrita da identidade visual da instalação.
 *
 * <p>A leitura é cacheada porque acontece em <em>toda</em> abertura da
 * aplicação, inclusive antes do login (a tela de login já mostra o logotipo do
 * cliente) — seria um SELECT por visitante para um dado que muda uma vez por
 * ano. As escritas invalidam o cache explicitamente.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarcaService {

    private final ConfiguracaoMarcaRepository repository;
    private final UploadService uploadService;

    /** Qual dos dois logotipos a operação afeta. */
    public enum Variante { PRINCIPAL, INVERSO }

    @Transactional(readOnly = true)
    @Cacheable(CacheConfig.MARCA)
    public MarcaResponse buscar() {
        return MarcaResponse.from(carregar());
    }

    @Transactional
    @CacheEvict(value = CacheConfig.MARCA, allEntries = true)
    public MarcaResponse atualizar(MarcaRequest request) {
        ConfiguracaoMarca marca = carregar();
        marca.setNome(request.nome().trim());
        // Assinatura em branco e ausente são a mesma coisa — normalizar para
        // null evita que o frontend tenha de distinguir "" de null ao decidir
        // se renderiza a linha de assinatura.
        String assinatura = request.assinatura() == null ? null : request.assinatura().trim();
        marca.setAssinatura(assinatura == null || assinatura.isEmpty() ? null : assinatura);
        repository.save(marca);
        log.info("Identidade da instalação atualizada: nome={}", marca.getNome());
        return MarcaResponse.from(marca);
    }

    /**
     * Grava o novo logotipo e só então descarta o anterior — mesma ordem do
     * {@code ImagemUploadService}: se a gravação falhar, a instalação continua
     * apontando para um arquivo que existe.
     */
    @Transactional
    @CacheEvict(value = CacheConfig.MARCA, allEntries = true)
    public MarcaResponse atualizarLogo(Variante variante, MultipartFile file) throws IOException {
        ConfiguracaoMarca marca = carregar();
        String anterior = urlAtual(marca, variante);

        String url = uploadService.salvar(file, "marca");
        aplicarUrl(marca, variante, url);
        repository.save(marca);

        uploadService.deletar(anterior);
        log.info("Logotipo da instalação atualizado: variante={}", variante);
        return MarcaResponse.from(marca);
    }

    @Transactional
    @CacheEvict(value = CacheConfig.MARCA, allEntries = true)
    public MarcaResponse removerLogo(Variante variante) {
        ConfiguracaoMarca marca = carregar();
        String anterior = urlAtual(marca, variante);
        aplicarUrl(marca, variante, null);
        repository.save(marca);

        uploadService.deletar(anterior);
        log.info("Logotipo da instalação removido: variante={}", variante);
        return MarcaResponse.from(marca);
    }

    /**
     * A linha nasce na migration V22, então "não existe" seria estado corrompido
     * (alguém apagou a linha) — e não um caso de negócio. Recriar com o padrão
     * de fábrica é preferível a derrubar toda tela pública com 500.
     */
    private ConfiguracaoMarca carregar() {
        return repository.findById(ConfiguracaoMarca.ID).orElseGet(() -> {
            log.warn("configuracao_marca sem a linha id={} — recriando com o padrão de fábrica",
                    ConfiguracaoMarca.ID);
            return repository.save(ConfiguracaoMarca.builder()
                    .id(ConfiguracaoMarca.ID)
                    .nome("LMS")
                    .assinatura("Sistema de Gestão de Cursos")
                    .build());
        });
    }

    private String urlAtual(ConfiguracaoMarca marca, Variante variante) {
        return variante == Variante.INVERSO ? marca.getLogoInversoUrl() : marca.getLogoUrl();
    }

    private void aplicarUrl(ConfiguracaoMarca marca, Variante variante, String url) {
        if (variante == Variante.INVERSO) marca.setLogoInversoUrl(url);
        else marca.setLogoUrl(url);
    }
}
