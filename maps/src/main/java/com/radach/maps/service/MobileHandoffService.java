package com.radach.maps.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.AuthResponse;
import com.radach.maps.dto.MobileHandoffConsumeResponse;
import com.radach.maps.dto.MobileHandoffCreateResponse;
import com.radach.maps.exception.BadCredentialsException;
import com.radach.maps.model.MobileHandoffToken;
import com.radach.maps.model.User;
import com.radach.maps.repository.MobileHandoffTokenRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class MobileHandoffService {

    private static final Duration HANDOFF_TTL = Duration.ofMinutes(5);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MobileHandoffTokenRepository handoffTokenRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public MobileHandoffService(
            MobileHandoffTokenRepository handoffTokenRepository,
            UserRepository userRepository,
            JwtService jwtService,
            RefreshTokenService refreshTokenService
    ) {
        this.handoffTokenRepository = handoffTokenRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional
    public MobileHandoffCreateResponse create(Long userId, String targetPath) {
        String safeTargetPath = normalizeTargetPath(targetPath);
        String token = generateToken();
        Instant expiresAt = Instant.now().plus(HANDOFF_TTL);

        MobileHandoffToken handoff = new MobileHandoffToken();
        handoff.setUserId(userId);
        handoff.setToken(token);
        handoff.setTargetPath(safeTargetPath);
        handoff.setExpiresAt(expiresAt);
        handoffTokenRepository.save(handoff);

        return new MobileHandoffCreateResponse(token, "/mobile-handoff/" + token, expiresAt);
    }

    @Transactional
    public MobileHandoffConsumeResponse consume(String token) {
        if (token == null || token.isBlank()) {
            throw new BadCredentialsException("Invalid handoff token");
        }

        MobileHandoffToken handoff = handoffTokenRepository.findByToken(token)
                .orElseThrow(() -> new BadCredentialsException("Invalid handoff token"));

        Instant now = Instant.now();
        if (handoff.getConsumedAt() != null || handoff.getExpiresAt().isBefore(now)) {
            throw new BadCredentialsException("Handoff token expired");
        }

        handoff.setConsumedAt(now);
        handoffTokenRepository.save(handoff);

        User user = userRepository.findById(handoff.getUserId())
                .orElseThrow(() -> new BadCredentialsException("User not found"));

        String accessToken = jwtService.generateToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.createRefreshToken(user.getId());
        AuthResponse auth = new AuthResponse(
                accessToken,
                user.getId(),
                user.getRole().name(),
                refreshToken,
                user.isExpert(),
                user.isOnboardingCompleted()
        );

        return new MobileHandoffConsumeResponse(auth, handoff.getTargetPath());
    }

    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void purgeExpiredOrConsumed() {
        handoffTokenRepository.deleteExpiredOrConsumed(Instant.now());
    }

    private String normalizeTargetPath(String targetPath) {
        if (targetPath == null || targetPath.isBlank()) {
            return "/";
        }
        String trimmed = targetPath.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.contains("\n") || trimmed.contains("\r")) {
            throw new IllegalArgumentException("targetPath must be a local path");
        }
        return trimmed;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
