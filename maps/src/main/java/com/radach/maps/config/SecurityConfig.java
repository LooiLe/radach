package com.radach.maps.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          RateLimitFilter rateLimitFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Password login is disabled. Use a JWT bearer token.");
        };
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> {})
            .csrf(csrf -> csrf.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                // Public: static pages and auth endpoints
                .requestMatchers(
                    "/",
                    "/index.html",
                    "/login",
                    "/login.html",
                    "/register",
                    "/register.html",
                    "/spots",
                    "/spots.html",
                    "/trending",
                    "/trending.html",
                    "/search",
                    "/search.html",
                    "/spot",
                    "/spot.html",
                    "/favicon.ico",
                    "/css/**",
                    "/js/**",
                    "/uploads/**",
                    "/api/v1/auth/**"
                ).permitAll()
                // Actuator endpoints: health is public, others require ADMIN
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers("/actuator/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                // Public read-only API
                .requestMatchers(HttpMethod.GET, "/api/v1/spots", "/api/v1/spots/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/itineraries/share/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/tags", "/api/v1/tags/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/events/my-submissions").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/events", "/api/v1/events/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/paths/my-submissions").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/v1/spots/*/paths").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/paths/*").permitAll()
                // Stripe webhook + pricing (public, no auth required)
                .requestMatchers("/api/v1/webhooks/stripe").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/pricing").permitAll()
                // Follow endpoints: GET check is public (returns follower count), POST/DELETE require auth
                .requestMatchers(HttpMethod.GET, "/api/v1/follows/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/follows/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/follows/**").authenticated()
                // Authenticated interactions
                .requestMatchers(HttpMethod.POST, "/api/v1/spots/*/view", "/api/v1/spots/*/save").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/spots/*/reviews").authenticated()
                // Admin pages require ADMIN or SUPER_ADMIN role
                .requestMatchers("/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                .requestMatchers("/api/v1/super-admin/**").hasRole("SUPER_ADMIN")
                // Everything else requires authentication
                .anyRequest().authenticated()
            )
            // Rate limiting runs before JWT auth
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}