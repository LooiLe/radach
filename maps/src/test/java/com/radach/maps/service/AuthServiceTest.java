package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.radach.maps.dto.AuthResponse;
import com.radach.maps.dto.LoginRequest;
import com.radach.maps.dto.RegisterRequest;
import com.radach.maps.exception.BadCredentialsException;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private RefreshTokenService refreshTokenService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, passwordEncoder, jwtService, refreshTokenService);
    }

    @Test
    void register_createsUserAndReturnsToken() {
        var request = new RegisterRequest("alice@example.com", "password123", "Alice");

        when(userRepository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(jwtService.generateToken("alice@example.com", Role.USER)).thenReturn("token");
        when(refreshTokenService.createRefreshToken(any())).thenReturn("refresh-token");

        User saved = new User();
        saved.setName("Alice");
        saved.setEmail("alice@example.com");
        saved.setPasswordHash("encoded");
        saved.setRole(Role.USER);
        when(userRepository.save(any())).thenReturn(saved);

        AuthResponse response = authService.register(request);

        assertThat(response.token()).isEqualTo("token");
        assertThat(response.role()).isEqualTo("USER");
    }

    @Test
    void register_throwsWhenEmailExists() {
        var request = new RegisterRequest("alice@example.com", "password123", "Alice");

        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Email already exists");
    }

    @Test
    void login_returnsTokenOnSuccess() {
        var request = new LoginRequest("alice@example.com", "password123");

        User user = new User();
        user.setName("Alice");
        user.setEmail("alice@example.com");
        user.setPasswordHash("encoded");
        user.setRole(Role.USER);

        when(userRepository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "encoded")).thenReturn(true);
        when(jwtService.generateToken("alice@example.com", Role.USER)).thenReturn("token");
        when(refreshTokenService.createRefreshToken(any())).thenReturn("refresh-token");

        AuthResponse response = authService.login(request);

        assertThat(response.token()).isEqualTo("token");
        assertThat(response.role()).isEqualTo("USER");
    }

    @Test
    void login_throwsGenericErrorWhenUserNotFound() {
        var request = new LoginRequest("missing@example.com", "password123");

        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void login_throwsGenericErrorWhenPasswordInvalid() {
        var request = new LoginRequest("alice@example.com", "wrong");

        User user = new User();
        user.setPasswordHash("encoded");

        when(userRepository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid email or password");
    }
}