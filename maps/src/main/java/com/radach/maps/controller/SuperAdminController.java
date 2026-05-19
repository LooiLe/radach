package com.radach.maps.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;

@RestController
@RequestMapping("/api/v1/super-admin")
public class SuperAdminController {

    private final UserRepository userRepository;

    public SuperAdminController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<UserResponse> getUsers(@RequestParam(required = false) String query) {
        List<User> users = (query != null && !query.isBlank())
                ? userRepository.searchByNameOrEmail(query)
                : userRepository.findAllByOrderByIdAsc();
        return users.stream()
                .map(u -> new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.isExpert()))
                .toList();
    }

    @PutMapping("/users/{id}/promote")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public UserResponse promoteToAdmin(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (user.getRole() != Role.USER) {
            throw new IllegalArgumentException("Can only promote users with role USER");
        }
        user.setRole(Role.ADMIN);
        user = userRepository.save(user);
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole().name(), user.isExpert());
    }

    @PutMapping("/users/{id}/demote")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public UserResponse demoteToUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (user.getRole() != Role.ADMIN) {
            throw new IllegalArgumentException("Can only demote users with role ADMIN");
        }
        user.setRole(Role.USER);
        user = userRepository.save(user);
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole().name(), user.isExpert());
    }


    // Inner DTO
    public record UserResponse(Long id, String name, String email, String role, boolean isExpert) {}
}