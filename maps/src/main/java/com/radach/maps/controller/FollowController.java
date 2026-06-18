package com.radach.maps.controller;

import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.FollowService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/follows")
public class FollowController {

    private final FollowService followService;
    private final AuthenticatedUserService authenticatedUserService;

    public FollowController(FollowService followService, AuthenticatedUserService authenticatedUserService) {
        this.followService = followService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @PostMapping("/{expertId}")
    public ResponseEntity<?> followExpert(@PathVariable Long expertId, Authentication auth) {
        Long userId = getUserIdOrThrow(auth);
        followService.followExpert(userId, expertId);
        return ResponseEntity.ok(Map.of("following", true));
    }

    @DeleteMapping("/{expertId}")
    public ResponseEntity<?> unfollowExpert(@PathVariable Long expertId, Authentication auth) {
        Long userId = getUserIdOrThrow(auth);
        followService.unfollowExpert(userId, expertId);
        return ResponseEntity.ok(Map.of("following", false));
    }

    @GetMapping("/check/{expertId}")
    public ResponseEntity<?> checkFollowing(@PathVariable Long expertId, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        long followerCount = followService.getFollowerCount(expertId);
        boolean following = userId != null && followService.isFollowing(userId, expertId);
        return ResponseEntity.ok(Map.of("following", following, "followerCount", followerCount));
    }

    @GetMapping("/experts")
    public ResponseEntity<?> getFollowedExperts(Authentication auth) {
        Long userId = getUserIdOrThrow(auth);
        java.util.List<Map<String, Object>> experts = followService.getFollowedExperts(userId).stream()
                .map(u -> {
                    java.util.Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", u.getId());
                    map.put("name", u.getName());
                    map.put("profilePicture", u.getProfilePicture() != null ? u.getProfilePicture() : "");
                    map.put("professionalTitle", u.getProfessionalTitle() != null ? u.getProfessionalTitle() : "");
                    return map;
                })
                .toList();
        return ResponseEntity.ok(experts);
    }

    private Long getUserIdOrThrow(Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return userId;
    }

    private Long getUserIdOrNull(Authentication auth) {
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            try {
                return authenticatedUserService.getUserId(auth);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }
}