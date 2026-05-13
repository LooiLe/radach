package com.radach.maps.service;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;

/**
 * Shared utility for extracting the currently authenticated user.
 * Eliminates duplicated lookup logic across controllers.
 */
@Service
public class AuthenticatedUserService {

    private final UserRepository userRepository;

    public AuthenticatedUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
    }

    public Long getUserId(Authentication authentication) {
        return getUser(authentication).getId();
    }
}
