package com.radach.maps.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.AuthResponse;
import com.radach.maps.dto.LoginRequest;
import com.radach.maps.dto.RegisterRequest;
import com.radach.maps.exception.BadCredentialsException;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokenService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
    }

    // REGISTER
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();

        // 1. check if user exists
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        // 2. create user
        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);

        user = userRepository.save(user);

        // 3. generate access + refresh tokens
        String token = jwtService.generateToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.createRefreshToken(user.getId());

        // 4. return response
        return new AuthResponse(token, user.getId(), user.getRole().name(), refreshToken);
    }

    // LOGIN
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        // 1. find user — generic error prevents email enumeration
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        // 2. check password — same generic error
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        // 3. generate access + refresh tokens
        String token = jwtService.generateToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.createRefreshToken(user.getId());

        // 4. return response
        return new AuthResponse(token, user.getId(), user.getRole().name(), refreshToken);
    }
}
