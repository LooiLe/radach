package com.radach.maps.config;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Application-level rate limiter using Bucket4j.
 * Applies different limits to auth endpoints (strict) vs search/API (relaxed).
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Per-IP buckets for auth endpoints: 10 requests / minute
    private final Map<String, Bucket> authBuckets = new ConcurrentHashMap<>();

    // Per-IP buckets for search endpoints: 60 requests / minute
    private final Map<String, Bucket> searchBuckets = new ConcurrentHashMap<>();

    // Per-IP buckets for general API: 600 requests / minute (map viewport changes fire frequently)
    private final Map<String, Bucket> apiBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String ip = getClientIp(request);

        Bucket bucket;
        if (path.startsWith("/api/v1/auth/")) {
            // Strict rate limit on auth endpoints: 10 req/min to prevent credential stuffing
            bucket = authBuckets.computeIfAbsent(ip, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.simple(10, Duration.ofMinutes(1)))
                            .build());
        } else if (path.contains("/search")) {
            // Moderate limit on search: 60 req/min (autocomplete fires frequently)
            bucket = searchBuckets.computeIfAbsent(ip, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.simple(60, Duration.ofMinutes(1)))
                            .build());
        } else if (path.startsWith("/api/")) {
            // General API limit: 600 req/min (map viewport changes fire frequently during pan/zoom)
            bucket = apiBuckets.computeIfAbsent(ip, k ->
                    Bucket.builder()
                            .addLimit(Bandwidth.simple(600, Duration.ofMinutes(1)))
                            .build());
        } else {
            // Not an API path (static files, etc.), skip rate limiting
            filterChain.doFilter(request, response);
            return;
        }

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            MAPPER.writeValue(response.getWriter(),
                    Map.of("error", "Too many requests. Please try again later.", "status", 429));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
