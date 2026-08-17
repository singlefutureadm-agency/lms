package br.com.lms.domain.marca;

import br.com.lms.config.CacheConfig;
import br.com.lms.domain.upload.UploadService;
import br.com.lms.dto.DTOs.MarcaRequest;
import br.com.lms.dto.DTOs.MarcaResponse;
import br.com.lms.dto.DTOs.TemaDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

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
    private final ObjectMapper objectMapper;

    /** Qual dos dois logotipos a operação afeta. */
    public enum Variante { PRINCIPAL, INVERSO }

    @Transactional(readOnly = true)
    @Cacheable(CacheConfig.MARCA)
    public MarcaResponse buscar() {
        ConfiguracaoMarca marca = carregar();
        return MarcaResponse.from(marca, lerTema(marca));
    }

    @Transactional
    @CacheEvict(value = CacheConfig.MARCA, allEntries = true)
    public MarcaResponse atualizarTema(TemaDTO tema) {
        ConfiguracaoMarca marca = carregar();
        marca.setTema(objectMapper.writeValueAsString(tema));
        repository.save(marca);
        log.info("Tema da instalação atualizado");
        return MarcaResponse.from(marca, tema);
    }

    /** Volta ao padrão de fábrica gravando null — ver a coluna em V23. */
    @Transactional
    @CacheEvict(value = CacheConfig.MARCA, allEntries = true)
    public MarcaResponse restaurarTema() {
        ConfiguracaoMarca marca = carregar();
        marca.setTema(null);
        repository.save(marca);
        log.info("Tema da instalação restaurado para o padrão de fábrica");
        return MarcaResponse.from(marca, null);
    }

    /**
     * Um JSON ilegível na coluna não pode derrubar a aplicação inteira: a
     * aparência é lida em toda abertura, inclusive na tela pública. Diante de
     * conteúdo corrompido, cai no padrão de fábrica e registra o problema.
     */
    private TemaDTO lerTema(ConfiguracaoMarca marca) {
        if (marca.getTema() == null || marca.getTema().isBlank()) return null;
        try {
            return objectMapper.readValue(marca.getTema(), TemaDTO.class);
        } catch (RuntimeException e) {
            log.error("Tema da instalação ilegível — aplicando o padrão de fábrica", e);
            return null;
        }
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
        return MarcaResponse.from(marca, lerTema(marca));
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
        return MarcaResponse.from(marca, lerTema(marca));
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
        return MarcaResponse.from(marca, lerTema(marca));
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
