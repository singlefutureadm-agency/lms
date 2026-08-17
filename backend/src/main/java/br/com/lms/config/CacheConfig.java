package br.com.lms.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Cache em memória (Caffeine) apenas para dados de referência: a árvore
 * área→categoria, os tipos e as regiões/unidades. São dados quase estáticos
 * (4 regiões e 64 unidades vindas do seed) consultados em toda navegação pública.
 *
 * <p><b>O lookup de usuário do {@code UserDetailsServiceImpl} é deliberadamente
 * não-cacheado.</b> O desenho de autenticação do projeto depende de recarregar o
 * usuário do banco a cada request: é isso que faz uma troca de role ter efeito
 * imediato, sem precisar revogar o token já emitido. Cachear ali trocaria essa
 * garantia por um ganho de latência.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String AREAS = "areas";
    public static final String TIPOS = "tipos";
    public static final String REGIOES = "regioes";
    /** Identidade visual: uma linha só, lida em toda abertura da aplicação
     *  (inclusive na tela de login, antes de autenticar). */
    public static final String MARCA = "marca";

    @Bean
    public CaffeineCacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager(AREAS, TIPOS, REGIOES, MARCA);
        manager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(500)
                // Sem isto o Micrometer só consegue expor 'cache.size'; com as
                // estatísticas ligadas, hit ratio e evictions aparecem no Actuator.
                .recordStats()
                // TTL curto: mesmo com o evict explícito nas escritas, o teto de
                // 10 min limita a janela de inconsistência de qualquer caminho
                // que altere esses dados por fora (ex.: migration, SQL manual).
                .expireAfterWrite(Duration.ofMinutes(10)));
        return manager;
    }
}
