package com.radach.maps.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.ExpertProfileUpdateRequest;
import com.radach.maps.dto.UserReviewResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ReviewService;
import com.radach.maps.service.FeedService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/users")
public class UserProfileController {

    private final UserRepository userRepository;
    private final ReviewService reviewService;
    private final AuthenticatedUserService authenticatedUserService;
    private final FeedService feedService;
    private final com.radach.maps.service.FriendshipService friendshipService;

    public UserProfileController(UserRepository userRepository, ReviewService reviewService, AuthenticatedUserService authenticatedUserService, FeedService feedService, com.radach.maps.service.FriendshipService friendshipService) {
        this.userRepository = userRepository;
        this.reviewService = reviewService;
        this.authenticatedUserService = authenticatedUserService;
        this.feedService = feedService;
        this.friendshipService = friendshipService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getUserProfile(@PathVariable Long id, Authentication auth) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("isExpert", user.isExpert());
        profile.put("privateAccount", user.isPrivateAccount());
        profile.put("bio", user.getBio());
        profile.put("professionalTitle", user.getProfessionalTitle());
        profile.put("organization", user.getOrganization());
        profile.put("yearsExperience", user.getYearsExperience());
        profile.put("specializations", user.getSpecializations());
        profile.put("portfolioUrl", user.getPortfolioUrl());

        if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
            Long currentUserId = authenticatedUserService.getUserId(auth);
            Set<Long> friends = friendshipService.getFirstDegreeConnections(currentUserId);
            profile.put("isFriend", friends.contains(id));
        } else {
            profile.put("isFriend", false);
        }

        return ResponseEntity.ok(profile);
    }

    @GetMapping("/{id}/reviews")
    public Page<UserReviewResponse> getUserReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return reviewService.getUserReviews(id, page, size);
    }

    @GetMapping("/{id}/feed")
    public ResponseEntity<java.util.List<FeedService.FeedItem>> getUserFeed(
            @PathVariable Long id,
            @RequestParam(defaultValue = "30") int limit,
            Authentication auth
    ) {
        Long requesterId = auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser") ? 
            authenticatedUserService.getUserId(auth) : null;
        
        return ResponseEntity.ok(feedService.getFeed(requesterId, "user", Math.min(limit, 100), id));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> updateMyProfile(
            @Valid @RequestBody ExpertProfileUpdateRequest request,
            Authentication authentication
    ) {
        Long userId = authenticatedUserService.getUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // All users can set their bio; expert-specific fields only if isExpert
        if (request.bio() != null) {
            user.setBio(request.bio().trim());
        }
        if (request.privateAccount() != null) {
            user.setPrivateAccount(request.privateAccount());
        }
        if (user.isExpert()) {
            if (request.professionalTitle() != null) user.setProfessionalTitle(request.professionalTitle().trim());
            if (request.organization() != null) user.setOrganization(request.organization().trim());
            if (request.yearsExperience() != null) user.setYearsExperience(request.yearsExperience());
            if (request.specializations() != null) user.setSpecializations(request.specializations().trim());
            if (request.portfolioUrl() != null) user.setPortfolioUrl(request.portfolioUrl().trim());
        }
        userRepository.save(user);

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("isExpert", user.isExpert());
        profile.put("privateAccount", user.isPrivateAccount());
        profile.put("bio", user.getBio());
        profile.put("professionalTitle", user.getProfessionalTitle());
        profile.put("organization", user.getOrganization());
        profile.put("yearsExperience", user.getYearsExperience());
        profile.put("specializations", user.getSpecializations());
        profile.put("portfolioUrl", user.getPortfolioUrl());

        return ResponseEntity.ok(profile);
    }
}
