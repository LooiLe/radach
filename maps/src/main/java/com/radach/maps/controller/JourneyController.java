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

import com.radach.maps.dto.JourneyRequest;
import com.radach.maps.dto.JourneyResponse;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.JourneyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class JourneyController {

    private final JourneyService journeyService;
    private final AuthenticatedUserService authenticatedUserService;

    public JourneyController(JourneyService journeyService,
                             AuthenticatedUserService authenticatedUserService) {
        this.journeyService = journeyService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/spots/{spotId}/paths")
    public List<JourneyResponse> getPathsForSpot(@PathVariable Long spotId, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return journeyService.getPathsForSpot(spotId, userId);
    }

    @GetMapping("/journeys/{id}")
    public JourneyResponse getPath(@PathVariable Long id, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return journeyService.getPath(id, userId);
    }

    @PostMapping("/journeys/{id}/upvote")
    public ResponseEntity<JourneyResponse> toggleUpvote(@PathVariable Long id, Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        JourneyResponse response = journeyService.toggleUpvote(id, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/spots/{spotId}/paths")
    public ResponseEntity<JourneyResponse> submitPath(@PathVariable Long spotId,
                                                       @Valid @RequestBody JourneyRequest request,
                                                       Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");

        JourneyRequest adjusted = new JourneyRequest(
                spotId, request.journeyCategoryId(), request.name(), request.description(), request.difficulty(),
                request.estimatedDurationMin(), request.distanceMeters(),
                request.geoJson(), request.photos(), request.isPrivate()
        );

        JourneyResponse response = journeyService.submitPath(adjusted, user.getId(), isAdmin);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/journeys")
    public ResponseEntity<JourneyResponse> submitPathWithoutSpot(
                                                       @Valid @RequestBody JourneyRequest request,
                                                       Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");

        JourneyResponse response = journeyService.submitPath(request, user.getId(), isAdmin);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/journeys/{id}")
    public ResponseEntity<JourneyResponse> updatePath(@PathVariable Long id,
                                                       @Valid @RequestBody JourneyRequest request,
                                                       Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");
        JourneyResponse response = journeyService.updatePath(id, request, user.getId(), isAdmin);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/journeys/{id}")
    public ResponseEntity<?> deletePath(@PathVariable Long id, Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");
        journeyService.deletePath(id, user.getId(), isAdmin);
        return ResponseEntity.ok(Map.of("message", "Journey deleted successfully"));
    }

    @GetMapping("/journeys")
    public List<JourneyResponse> getAllJourneys(Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return journeyService.getAllJourneys(userId);
    }

    @GetMapping("/journeys/my-submissions")
    public List<JourneyResponse> getMySubmissions(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return journeyService.getMySubmissions(userId);
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