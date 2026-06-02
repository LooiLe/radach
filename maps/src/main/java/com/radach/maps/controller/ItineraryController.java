package com.radach.maps.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.radach.maps.dto.ItineraryRequest;
import com.radach.maps.dto.ItineraryResponse;
import com.radach.maps.dto.StopRequest;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.ItineraryService;

@RestController
@RequestMapping("/api/v1/itineraries")
public class ItineraryController {

    private final ItineraryService itineraryService;
    private final AuthenticatedUserService authenticatedUserService;

    public ItineraryController(ItineraryService itineraryService,
                                AuthenticatedUserService authenticatedUserService) {
        this.itineraryService = itineraryService;
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

    @DeleteMapping("/{id}/stops/{stopId}")
    public ResponseEntity<ItineraryResponse> removeStop(Authentication auth, @PathVariable Long id,
                                                         @PathVariable Long stopId) {
        Long userId = authenticatedUserService.getUserId(auth);
        return ResponseEntity.ok(itineraryService.removeStop(userId, id, stopId));
    }
}
