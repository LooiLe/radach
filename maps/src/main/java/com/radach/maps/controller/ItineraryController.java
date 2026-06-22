package com.radach.maps.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.radach.maps.dto.ItineraryRequest;
import com.radach.maps.dto.ItineraryResponse;
import com.radach.maps.dto.ItinerarySpotActionRequest;
import com.radach.maps.dto.StopRequest;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ItineraryGenerationService;
import com.radach.maps.service.ItineraryService;

@RestController
@RequestMapping("/api/v1/itineraries")
public class ItineraryController {

    private final ItineraryService itineraryService;
    private final ItineraryGenerationService generationService;
    private final AuthenticatedUserService authenticatedUserService;

    public ItineraryController(ItineraryService itineraryService,
                                ItineraryGenerationService generationService,
                                AuthenticatedUserService authenticatedUserService) {
        this.itineraryService = itineraryService;
        this.generationService = generationService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping
    public ResponseEntity<List<ItineraryResponse>> getMyItineraries(Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.getMyItineraries(userId));
    }

    @PostMapping
    public ResponseEntity<ItineraryResponse> createItinerary(Authentication auth,
                                                              @RequestBody ItineraryRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.createItinerary(userId, request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ItineraryResponse> getItinerary(Authentication auth, @PathVariable Long id) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.getItinerary(userId, id));
    }

    @GetMapping("/share/{shareToken}")
    public ResponseEntity<ItineraryResponse> getSharedItinerary(@PathVariable String shareToken) {
        return ResponseEntity.ok(itineraryService.getSharedItinerary(shareToken));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ItineraryResponse> updateItinerary(Authentication auth, @PathVariable Long id,
                                                              @RequestBody ItineraryRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.updateItinerary(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItinerary(Authentication auth, @PathVariable Long id) {
        Long userId = authenticatedUserService.getUserId(auth);
        itineraryService.deleteItinerary(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/reorder")
    public ResponseEntity<ItineraryResponse> reorderStops(Authentication auth, @PathVariable Long id,
                                                           @RequestBody List<Long> stopIds) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.reorderStops(userId, id, stopIds));
    }

    @PostMapping("/{id}/stops")
    public ResponseEntity<ItineraryResponse> addStop(Authentication auth, @PathVariable Long id,
                                                      @RequestBody StopRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.addStop(userId, id, request));
    }

    @PostMapping("/{id}/stops/after/{afterStopId}")
    public ResponseEntity<ItineraryResponse> addSpotAfterStop(Authentication auth, @PathVariable Long id,
                                                               @PathVariable Long afterStopId,
                                                               @RequestBody ItinerarySpotActionRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.addSpotAfterStop(userId, id, afterStopId, request.spotId()));
    }

    @PatchMapping("/{id}/stops/{stopId}/spot")
    public ResponseEntity<ItineraryResponse> replaceStopSpot(Authentication auth, @PathVariable Long id,
                                                              @PathVariable Long stopId,
                                                              @RequestBody ItinerarySpotActionRequest request) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.replaceStopSpot(userId, id, stopId, request.spotId()));
    }

    @PostMapping("/{id}/stops/{stopId}/optimize-remaining")
    public ResponseEntity<ItineraryResponse> optimizeRemainingStops(Authentication auth, @PathVariable Long id,
                                                                     @PathVariable Long stopId) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.optimizeRemainingStops(userId, id, stopId));
    }

    @DeleteMapping("/{id}/stops/{stopId}")
    public ResponseEntity<ItineraryResponse> removeStop(Authentication auth, @PathVariable Long id,
                                                         @PathVariable Long stopId) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.removeStop(userId, id, stopId));
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<ItineraryResponse> cloneItinerary(Authentication auth, @PathVariable Long id) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.cloneItinerary(userId, id));
    }

    @PostMapping("/{id}/regenerate")
    public ResponseEntity<ItineraryResponse> regenerateItinerary(Authentication auth, @PathVariable Long id) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(generationService.regenerateItinerary(userId, id));
    }

    @PostMapping("/{id}/stops/{stopId}/swap")
    public ResponseEntity<ItineraryResponse> swapStop(Authentication auth, @PathVariable Long id,
                                                       @PathVariable Long stopId) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(generationService.swapStop(userId, id, stopId));
    }
}
