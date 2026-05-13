package com.radach.maps.controller;

import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.UserReviewResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.ReviewService;

@RestController
@RequestMapping("/api/v1/users")
public class UserProfileController {

    private final UserRepository userRepository;
    private final ReviewService reviewService;

    public UserProfileController(UserRepository userRepository, ReviewService reviewService) {
        this.userRepository = userRepository;
        this.reviewService = reviewService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getUserProfile(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail()
        ));
    }

    @GetMapping("/{id}/reviews")
    public Page<UserReviewResponse> getUserReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return reviewService.getUserReviews(id, page, size);
    }
}
