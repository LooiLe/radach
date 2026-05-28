package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.TrailPathRequest;
import com.radach.maps.dto.TrailPathResponse;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.TrailPathService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class TrailPathController {

    private final TrailPathService trailPathService;
    private final AuthenticatedUserService authenticatedUserService;

    public TrailPathController(TrailPathService trailPathService,
                               AuthenticatedUserService authenticatedUserService) {
        this.trailPathService = trailPathService;
        this.authenticatedUserService = authenticatedUserService;
    }

    /** List active (public) paths for a trail spot. Public endpoint. */
    @GetMapping("/spots/{spotId}/paths")
    public List<TrailPathResponse> getPathsForSpot(@PathVariable Long spotId, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return trailPathService.getPathsForSpot(spotId, userId);
    }

    /** Get a single trail path. Public endpoint. */
    @GetMapping("/paths/{id}")
    public TrailPathResponse getPath(@PathVariable Long id, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return trailPathService.getPath(id, userId);
    }

    /** Toggle upvote on a trail path. */
    @PostMapping("/paths/{id}/upvote")
    public ResponseEntity<TrailPathResponse> toggleUpvote(@PathVariable Long id, Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        TrailPathResponse response = trailPathService.toggleUpvote(id, userId);
        return ResponseEntity.ok(response);
    }

    /** Submit a new trail path for a spot. Requires authentication. */
    @PostMapping("/spots/{spotId}/paths")
    public ResponseEntity<TrailPathResponse> submitPath(@PathVariable Long spotId,
                                                         @Valid @RequestBody TrailPathRequest request,
                                                         Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");

        // Override spotId from path variable
        TrailPathRequest adjusted = new TrailPathRequest(
                spotId, request.name(), request.description(), request.difficulty(),
                request.estimatedDurationMin(), request.distanceMeters(),
                request.geoJson(), request.photos(), request.isPrivate()
        );

        TrailPathResponse response = trailPathService.submitPath(adjusted, user.getId(), isAdmin);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** Update a trail path. Only the owner or admin can update. */
    @PutMapping("/paths/{id}")
    public ResponseEntity<TrailPathResponse> updatePath(@PathVariable Long id,
                                                         @Valid @RequestBody TrailPathRequest request,
                                                         Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");
        TrailPathResponse response = trailPathService.updatePath(id, request, user.getId(), isAdmin);
        return ResponseEntity.ok(response);
    }

    /** Delete a trail path. Only the owner or admin can delete. */
    @DeleteMapping("/paths/{id}")
    public ResponseEntity<?> deletePath(@PathVariable Long id, Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");
        trailPathService.deletePath(id, user.getId(), isAdmin);
        return ResponseEntity.ok(Map.of("message", "Trail path deleted successfully"));
    }

    /** Get paths submitted by the authenticated user. */
    @GetMapping("/paths/my-submissions")
    public List<TrailPathResponse> getMySubmissions(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return trailPathService.getMySubmissions(userId);
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
