package com.radach.maps.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.service.EventService;
import com.radach.maps.service.ExpertApplicationService;
import com.radach.maps.service.ReviewService;
import com.radach.maps.service.SpotService;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class AdminDashboardController {

    private final SpotService spotService;
    private final EventService eventService;
    private final ReviewService reviewService;
    private final ExpertApplicationService expertApplicationService;

    public AdminDashboardController(SpotService spotService,
                                    EventService eventService,
                                    ReviewService reviewService,
                                    ExpertApplicationService expertApplicationService) {
        this.spotService = spotService;
        this.eventService = eventService;
        this.reviewService = reviewService;
        this.expertApplicationService = expertApplicationService;
    }

    @GetMapping("/pending-count")
    public ResponseEntity<Map<String, Integer>> getPendingCount() {
        int pendingSpots = spotService.getPendingSpots().size();
        int pendingEvents = eventService.getPendingEvents().size();
        int pendingReviews = reviewService.getPendingReviews().size();
        int pendingExpertApps = expertApplicationService.getPendingApplications().size();

        int totalPending = pendingSpots + pendingEvents + pendingReviews + pendingExpertApps;

        return ResponseEntity.ok(Map.of("count", totalPending));
    }
}
