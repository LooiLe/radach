package com.radach.maps.controller;

import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.AuthenticatedUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/onboarding")
public class OnboardingController {

    private final UserRepository userRepository;
    private final AuthenticatedUserService authenticatedUserService;

    public OnboardingController(UserRepository userRepository,
                                 AuthenticatedUserService authenticatedUserService) {
        this.userRepository = userRepository;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Map<String, Object> response = new HashMap<>();
        response.put("onboardingCompleted", user.isOnboardingCompleted());
        response.put("interests", user.getInterests() != null ? Arrays.asList(user.getInterests().split(",")) : List.of());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/complete")
    public ResponseEntity<?> completeOnboarding(Authentication auth, @RequestBody Map<String, Object> body) {
        Long userId = authenticatedUserService.getUserId(auth);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        @SuppressWarnings("unchecked")
        List<String> interests = (List<String>) body.getOrDefault("interests", List.of());
        user.setInterests(String.join(",", interests));
        user.setOnboardingCompleted(true);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("onboardingCompleted", true));
    }

    @GetMapping("/experts")
    public ResponseEntity<?> getExperts(@RequestParam(required = false) String interests) {
        List<User> allExperts = userRepository.findAllExperts();

        if (interests == null || interests.isBlank()) {
            // Return all experts
            List<Map<String, Object>> experts = allExperts.stream()
                    .map(this::toExpertResponse)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(experts);
        }

        Set<String> interestSet = Arrays.stream(interests.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        List<Map<String, Object>> matchingExperts = allExperts.stream()
                .filter(e -> {
                    String specs = e.getSpecializations();
                    if (specs == null || specs.isBlank()) return false;
                    String[] specArray = specs.split(",");
                    for (String spec : specArray) {
                        if (interestSet.contains(spec.trim().toLowerCase())) {
                            return true;
                        }
                    }
                    return false;
                })
                .map(this::toExpertResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(matchingExperts);
    }

    @GetMapping("/users")
    public ResponseEntity<?> searchUsers(@RequestParam("q") String query, Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.ok(List.of());
        }
        List<User> results = userRepository.searchByNameOrEmail(query.trim());
        // Exclude the current user
        List<Map<String, Object>> users = results.stream()
                .filter(u -> !u.getId().equals(userId))
                .map(this::toUserResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    private Map<String, Object> toExpertResponse(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("email", user.getEmail());
        map.put("profilePicture", user.getProfilePicture());
        map.put("specializations", user.getSpecializations());
        return map;
    }

    private Map<String, Object> toUserResponse(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("email", user.getEmail());
        map.put("profilePicture", user.getProfilePicture());
        return map;
    }
}