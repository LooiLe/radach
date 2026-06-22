package com.radach.maps.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import com.radach.maps.dto.AuthResponse;
import com.radach.maps.dto.MobileHandoffConsumeResponse;
import com.radach.maps.dto.MobileHandoffCreateRequest;
import com.radach.maps.dto.MobileHandoffCreateResponse;
import com.radach.maps.dto.OtpRequest;
import com.radach.maps.dto.VerifyOtpRegisterRequest;
import com.radach.maps.dto.LoginRequest;
import com.radach.maps.service.AuthService;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.MobileHandoffService;
import com.radach.maps.service.RefreshTokenService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final MobileHandoffService mobileHandoffService;
    private final AuthenticatedUserService authenticatedUserService;

    public AuthController(
            AuthService authService,
            RefreshTokenService refreshTokenService,
            MobileHandoffService mobileHandoffService,
            AuthenticatedUserService authenticatedUserService
    ) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
        this.mobileHandoffService = mobileHandoffService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /**
     * Step 1: Send a 6-digit OTP to the user's email.
     * Validates that the email isn't already registered.
     */
    @PostMapping("/register/send-otp")
    public Map<String, String> sendOtp(@Valid @RequestBody OtpRequest request) {
        authService.sendRegistrationOtp(request.email());
        return Map.of("message", "Verification code sent to your email.");
    }

    /**
     * Step 2: Verify the OTP and create the account.
     * Returns access + refresh tokens on success.
     */
    @PostMapping("/register/verify")
    public AuthResponse verifyAndRegister(@Valid @RequestBody VerifyOtpRegisterRequest request) {
        return authService.register(request);
    }

    /**
     * Exchange a valid refresh token for a new access token + new refresh token.
     * Body: { "refreshToken": "..." }
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalArgumentException("refreshToken is required");
        }
        return refreshTokenService.refresh(refreshToken);
    }

    @PostMapping("/mobile-handoff")
    public MobileHandoffCreateResponse createMobileHandoff(
            Authentication auth,
            @RequestBody MobileHandoffCreateRequest request
    ) {
        Long userId = authenticatedUserService.getUserId(auth);
        return mobileHandoffService.create(userId, request.targetPath());
    }

    @PostMapping("/mobile-handoff/{token}")
    public MobileHandoffConsumeResponse consumeMobileHandoff(@org.springframework.web.bind.annotation.PathVariable String token) {
        return mobileHandoffService.consume(token);
    }
}
