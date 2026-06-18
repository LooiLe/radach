package com.radach.maps.controller;

import java.util.HashMap;
import java.util.List;
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
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.EventRepository;
import com.radach.maps.repository.JourneyRepository;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ReviewService;
import com.radach.maps.service.FeedService;
import com.radach.maps.service.AccountDeletionService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/users")
public class UserProfileController {

    private final UserRepository userRepository;
    private final ReviewService reviewService;
    private final AuthenticatedUserService authenticatedUserService;
    private final FeedService feedService;
    private final com.radach.maps.service.FriendshipService friendshipService;
    private final AccountDeletionService accountDeletionService;
    private final PasswordEncoder passwordEncoder;
    private final SpotRepository spotRepository;
    private final EventRepository eventRepository;
    private final JourneyRepository journeyRepository;

    public UserProfileController(UserRepository userRepository, ReviewService reviewService,
                                 AuthenticatedUserService authenticatedUserService, FeedService feedService,
                                 com.radach.maps.service.FriendshipService friendshipService,
                                 AccountDeletionService accountDeletionService, PasswordEncoder passwordEncoder,
                                 SpotRepository spotRepository, EventRepository eventRepository,
                                 JourneyRepository journeyRepository) {
        this.userRepository = userRepository;
        this.reviewService = reviewService;
        this.authenticatedUserService = authenticatedUserService;
        this.feedService = feedService;
        this.friendshipService = friendshipService;
        this.accountDeletionService = accountDeletionService;
        this.passwordEncoder = passwordEncoder;
        this.spotRepository = spotRepository;
        this.eventRepository = eventRepository;
        this.journeyRepository = journeyRepository;
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
        profile.put("profilePicture", user.getProfilePicture());
        profile.put("role", user.getRole().name());

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

    @GetMapping("/{id}/submitted-spots")
    public ResponseEntity<List<Map<String, Object>>> getSubmittedSpots(@PathVariable Long id) {
        var spots = spotRepository.findBySubmittedByOrderByCreatedAtDesc(id);
        List<Map<String, Object>> result = spots.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("name", s.getName());
            map.put("type", s.getType());
            map.put("address", s.getAddress());
            map.put("status", s.getStatus().name());
            map.put("createdAt", s.getCreatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/submitted-events")
    public ResponseEntity<List<Map<String, Object>>> getSubmittedEvents(@PathVariable Long id) {
        var events = eventRepository.findBySubmittedByOrderByCreatedAtDesc(id);
        List<Map<String, Object>> result = events.stream().map(e -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", e.getId());
            map.put("title", e.getTitle());
            map.put("status", e.getStatus() != null ? e.getStatus().name() : "PENDING");
            map.put("createdAt", e.getCreatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/submitted-journeys")
    public ResponseEntity<List<Map<String, Object>>> getSubmittedJourneys(@PathVariable Long id) {
        var journeys = journeyRepository.findBySubmittedByOrderByCreatedAtDesc(id);
        List<Map<String, Object>> result = journeys.stream().map(j -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", j.getId());
            map.put("name", j.getName());
            map.put("status", j.getStatus().name());
            map.put("createdAt", j.getCreatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
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

    @GetMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> getMyProfile(Authentication authentication) {
        Long userId = authenticatedUserService.getUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return ResponseEntity.ok(toProfileMap(user));
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
        if (request.profilePicture() != null) {
            user.setProfilePicture(request.profilePicture().trim());
        }
        if (user.isExpert()) {
            if (request.professionalTitle() != null) user.setProfessionalTitle(request.professionalTitle().trim());
            if (request.organization() != null) user.setOrganization(request.organization().trim());
            if (request.yearsExperience() != null) user.setYearsExperience(request.yearsExperience());
            if (request.specializations() != null) user.setSpecializations(request.specializations().trim());
            if (request.portfolioUrl() != null) user.setPortfolioUrl(request.portfolioUrl().trim());
        }
        userRepository.save(user);

        return ResponseEntity.ok(toProfileMap(user));
    }

    private Map<String, Object> toProfileMap(User user) {
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
        profile.put("profilePicture", user.getProfilePicture());

        return profile;
    }

    public record DeleteAccountRequest(
        @jakarta.validation.constraints.NotBlank String password
    ) {}

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteMyAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            Authentication authentication
    ) {
        Long userId = authenticatedUserService.getUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect password. Account deletion aborted."));
        }

        accountDeletionService.deleteAndAnonymizeUser(userId);

        return ResponseEntity.ok(Map.of("message", "Account successfully deleted and data anonymized."));
    }
}
