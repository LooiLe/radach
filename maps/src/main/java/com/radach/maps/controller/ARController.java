package com.radach.maps.controller;

import java.util.Arrays;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.radach.maps.dto.ARAnnotationRequest;
import com.radach.maps.dto.ARAnnotationResponse;
import com.radach.maps.dto.NearbyFeedPostResponse;
import com.radach.maps.dto.SpotExplanation;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.service.ARService;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.FeedPostService;
import com.radach.maps.service.FriendshipService;

@RestController
@RequestMapping("/api/v1/ar")
public class ARController {
    private final ARService arService;
    private final AuthenticatedUserService authenticatedUserService;
    private final FriendshipService friendshipService;
    private final FeedPostService feedPostService;

    public ARController(ARService arService, AuthenticatedUserService authenticatedUserService,
                        FriendshipService friendshipService, FeedPostService feedPostService) {
        this.arService = arService;
        this.authenticatedUserService = authenticatedUserService;
        this.friendshipService = friendshipService;
        this.feedPostService = feedPostService;
    }

    @GetMapping("/nearby")
    public List<SpotResponse> nearby(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM,
            @RequestParam(required = false) String excludeIds,
            @RequestParam(required = false) Long expertId,
            Authentication auth
    ) {
        Long userId = getUserIdOrNull(auth);
        if (expertId != null) {
            return arService.findNearbySpotsByExpert(lat, lng, expertId, radiusM, parseIds(excludeIds), userId);
        }
        return arService.findNearbySpots(lat, lng, radiusM, parseIds(excludeIds), userId);
    }

    @GetMapping("/alternatives")
    public List<SpotResponse> alternatives(
            @RequestParam Long spotId,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM
    ) {
        return arService.findAlternatives(spotId, lat, lng, radiusM);
    }

    @GetMapping("/explain")
    public SpotExplanation explain(
            @RequestParam Long spotId,
            @RequestParam(required = false) Long itineraryId,
            Authentication auth
    ) {
        return arService.buildExplanation(spotId, getUserIdOrNull(auth), itineraryId);
    }

    // ─── Annotation Endpoints ───

    @GetMapping("/annotations")
    public List<ARAnnotationResponse> nearbyAnnotations(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM
    ) {
        return arService.findNearbyAnnotations(lat, lng, radiusM);
    }

    @PostMapping("/annotations")
    public ARAnnotationResponse submitAnnotation(
            @RequestBody ARAnnotationRequest request,
            Authentication auth
    ) {
        Long userId = requireUserId(auth);
        return arService.submitAnnotation(userId, request);
    }

    @GetMapping("/annotations/pending")
    public List<ARAnnotationResponse> pendingAnnotations() {
        return arService.getPendingAnnotations();
    }

    @PatchMapping("/annotations/{id}/review")
    public ARAnnotationResponse reviewAnnotation(
            @PathVariable Long id,
            @RequestParam String action,
            @RequestParam(required = false) String note,
            Authentication auth
    ) {
        Long adminId = requireUserId(auth);
        return arService.reviewAnnotation(id, action, adminId, note);
    }

    @GetMapping("/feed/nearby")
    public List<NearbyFeedPostResponse> nearbyFriendPosts(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) Integer radiusM,
            Authentication auth
    ) {
        Long userId = requireUserId(auth);
        java.util.Set<Long> friendIds = friendshipService.getFirstDegreeConnections(userId);
        double radiusKm = radiusM != null ? radiusM / 1000.0 : 0.5; // default 500m
        return feedPostService.findNearbyFriendPosts(friendIds, lat, lng, radiusKm);
    }

    // ─── Helpers ───

    private Long getUserIdOrNull(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        try {
            return authenticatedUserService.getUserId(auth);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long requireUserId(Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return userId;
    }

    private List<Long> parseIds(String rawIds) {
        if (rawIds == null || rawIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(rawIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(Long::parseLong)
                .toList();
    }
}
