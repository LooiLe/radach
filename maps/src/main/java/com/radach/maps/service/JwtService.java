package com.radach.maps.service;

import java.util.Optional;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.radach.maps.model.Role;

@Service
public class JwtService {

    /** Parsed JWT claims returned as a single unit — avoids triple-parsing. */
    public record JwtClaims(String email, Role role) {}

    private final String secret;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs
    ) {
        this.secret = secret;
        this.expirationMs = expirationMs;
    }

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String email, Role role) {
        return Jwts.builder()
                .subject(email)
                .claim("role", role.name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getKey())
                .compact();
    }

    /**
     * Parse and validate a JWT in one pass.
     * Returns empty if the token is invalid, expired, or malformed.
     */
    public Optional<JwtClaims> parseToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String email = claims.getSubject();
            Role role = Role.valueOf(claims.get("role", String.class));
            return Optional.of(new JwtClaims(email, role));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
