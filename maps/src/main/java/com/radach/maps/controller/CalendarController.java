package com.radach.maps.controller;

import java.time.Instant;
import java.util.List;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.radach.maps.dto.CalendarEntryRequest;
import com.radach.maps.dto.CalendarEntryResponse;
import com.radach.maps.service.AuthenticatedUserService;
import com.radach.maps.service.CalendarService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {

    private final CalendarService calendarService;
    private final AuthenticatedUserService authenticatedUserService;

    public CalendarController(CalendarService calendarService,
                              AuthenticatedUserService authenticatedUserService) {
        this.calendarService = calendarService;
        this.authenticatedUserService = authenticatedUserService;
    }

    /** Get calendar entries for the current user, optionally filtered by date range. */
    @GetMapping
    public List<CalendarEntryResponse> getEntries(
            @RequestParam(required = false) Instant start,
            @RequestParam(required = false) Instant end,
            Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return calendarService.getEntries(userId, start, end);
    }

    /** Create a custom calendar entry. */
    @PostMapping
    public ResponseEntity<CalendarEntryResponse> createEntry(
            @Valid @RequestBody CalendarEntryRequest request,
            Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        CalendarEntryResponse response = calendarService.createEntry(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** Update a calendar entry. */
    @PutMapping("/{id}")
    public CalendarEntryResponse updateEntry(
            @PathVariable Long id,
            @Valid @RequestBody CalendarEntryRequest request,
            Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        return calendarService.updateEntry(id, request, userId);
    }

    /** Delete a calendar entry. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEntry(
            @PathVariable Long id, 
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String date,
            Authentication auth) {
        Long userId = authenticatedUserService.getUserId(auth);
        calendarService.deleteEntry(id, userId, mode, date);
        return ResponseEntity.noContent().build();
    }
}
