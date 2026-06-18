package com.radach.maps.service;

import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.AuthResponse;
import com.radach.maps.model.RefreshToken;
import com.radach.maps.model.User;
import com.radach.maps.repository.RefreshTokenRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final long refreshExpirationMs;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            UserRepository userRepository,
            JwtService jwtService,
            @Value("${app.jwt.refresh-expiration-ms}") long refreshExpirationMs
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    /**
     * Issue a new opaque refresh token for the given user.
     */
    @Transactional
    public String createRefreshToken(Long userId) {
        RefreshToken rt = new RefreshToken();
        rt.setUserId(userId);
        rt.setToken(UUID.randomUUID().toString());
        rt.setExpiresAt(Instant.now().plusMillis(refreshExpirationMs));
        refreshTokenRepository.save(rt);
        return rt.getToken();
    }

    /**
     * Exchange a valid refresh token for a new access token + new refresh token.
     * The old refresh token is consumed (single-use rotation).
     */
    @Transactional
    public AuthResponse refresh(String refreshTokenStr) {
        RefreshToken rt = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new com.radach.maps.exception.BadCredentialsException("Invalid refresh token"));

        if (rt.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(rt);
            throw new com.radach.maps.exception.BadCredentialsException("Refresh token expired");
        }

        User user = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> new com.radach.maps.exception.BadCredentialsException("User not found"));

        // Rotate: delete old, issue new
        refreshTokenRepository.delete(rt);
        String newRefreshToken = createRefreshToken(user.getId());
        String newAccessToken = jwtService.generateToken(user.getEmail(), user.getRole());

        return new AuthResponse(newAccessToken, user.getId(), user.getRole().name(), newRefreshToken, user.isExpert(), user.isOnboardingCompleted());
    }

    /**
     * Revoke all refresh tokens for a user (e.g. on logout or password change).
     */
    @Transactional
    public void revokeAllForUser(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    /**
     * Purge expired refresh tokens every 6 hours to keep the table clean.
     */
    @Scheduled(cron = "0 0 */6 * * *")
    @Transactional
    public void purgeExpiredTokens() {
        refreshTokenRepository.deleteExpiredTokens(Instant.now());
    }
}
