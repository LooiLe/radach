package com.radach.maps.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.EventRequest;
import com.radach.maps.dto.EventResponse;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.EventService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {

    private final EventService eventService;
    private final AuthenticatedUserService authenticatedUserService;

    public EventController(EventService eventService,
                           AuthenticatedUserService authenticatedUserService) {
        this.eventService = eventService;
        this.authenticatedUserService = authenticatedUserService;
    }

    /** List upcoming ACTIVE events with optional filters. Public endpoint. */
    @GetMapping
    public List<EventResponse> listEvents(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return eventService.getUpcomingEvents(city, month, year, userId);
    }

    /** Get events for a specific spot. Public endpoint. */
    @GetMapping("/spot/{spotId}")
    public List<EventResponse> getEventsForSpot(@PathVariable Long spotId, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return eventService.getEventsForSpot(spotId, userId);
    }

    /** Get a single event detail. Public endpoint. */
    @GetMapping("/{id}")
    public EventResponse getEvent(@PathVariable Long id, Authentication auth) {
        Long userId = getUserIdOrNull(auth);
        return eventService.getEvent(id, userId);
    }

    /** Submit a new event (requires authentication). */
    @PostMapping
    public ResponseEntity<EventResponse> submitEvent(@Valid @RequestBody EventRequest request,
                                                      Authentication auth) {
        var user = authenticatedUserService.getUser(auth);
        boolean isAdmin = user.getRole().name().contains("ADMIN");
        EventResponse response = eventService.submitEvent(request, user.getId(), isAdmin);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** Toggle like on an event. */
    @PostMapping("/{id}/like")
    public EventResponse toggleLike(@PathVariable Long id, Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return eventService.toggleLike(id, userId);
    }

    /** Add an event to the user's calendar. */
    @PostMapping("/{id}/calendar")
    public ResponseEntity<?> addToCalendar(@PathVariable Long id, Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        eventService.addToCalendar(id, userId);
        return ResponseEntity.ok(Map.of("message", "Event added to calendar"));
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
