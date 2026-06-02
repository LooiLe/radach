package com.radach.maps.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.CalendarEntryRequest;
import com.radach.maps.dto.CalendarEntryResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.CalendarEntry;
import com.radach.maps.repository.CalendarEntryRepository;

@Service
public class CalendarService {

    private final CalendarEntryRepository calendarEntryRepository;

    public CalendarService(CalendarEntryRepository calendarEntryRepository) {
        this.calendarEntryRepository = calendarEntryRepository;
    }

    /**
     * Get calendar entries for a user within a date range.
     */
    public List<CalendarEntryResponse> getEntries(Long userId, Instant start, Instant end) {
        List<CalendarEntry> entries;
        if (start != null && end != null) {
            entries = calendarEntryRepository.findEntriesWithinRange(userId, start, end);
        } else {
            entries = calendarEntryRepository.findByUserId(userId);
        }
        return entries.stream().map(this::toResponse).toList();
    }

    /**
     * Create a custom calendar entry (not linked to any event).
     */
    public CalendarEntryResponse createEntry(CalendarEntryRequest request, Long userId) {
        CalendarEntry entry = new CalendarEntry();
        entry.setUserId(userId);
        entry.setTitle(request.title());
        entry.setDescription(request.description());
        entry.setLocation(request.location());
        entry.setSpotId(request.spotId());
        entry.setStartTime(request.startTime());
        entry.setEndTime(request.endTime());
        entry.setRecurrenceRule(request.recurrenceRule());
        entry.setColor(request.color() != null ? request.color() : "#4f8cff");

        entry = calendarEntryRepository.save(entry);
        return toResponse(entry);
    }

    /**
     * Update a calendar entry (only own entries).
     */
    @Transactional
    public CalendarEntryResponse updateEntry(Long id, CalendarEntryRequest request, Long userId) {
        CalendarEntry entry = calendarEntryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar entry not found"));

        if (!entry.getUserId().equals(userId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Not your calendar entry");
        }

        entry.setTitle(request.title());
        entry.setDescription(request.description());
        entry.setLocation(request.location());
        entry.setSpotId(request.spotId());
        entry.setStartTime(request.startTime());
        entry.setEndTime(request.endTime());
        entry.setRecurrenceRule(request.recurrenceRule());
        if (request.color() != null) {
            entry.setColor(request.color());
        }

        entry = calendarEntryRepository.save(entry);
        return toResponse(entry);
    }

    /**
     * Delete a calendar entry (only own entries). Supports partial deletion for recurring events.
     */
    @Transactional
    public void deleteEntry(Long id, Long userId, String mode, String date) {
        CalendarEntry entry = calendarEntryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar entry not found"));

        if (!entry.getUserId().equals(userId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Not your calendar entry");
        }

        String rule = entry.getRecurrenceRule();
        if (rule == null || rule.isBlank() || "all".equalsIgnoreCase(mode) || mode == null) {
            calendarEntryRepository.delete(entry);
            return;
        }

        if ("thisEvent".equalsIgnoreCase(mode) && date != null && !date.isBlank()) {
            String newRule = rule.contains("EXDATE=") ? rule + "," + date : rule + ";EXDATE=" + date;
            entry.setRecurrenceRule(newRule);
            calendarEntryRepository.save(entry);
        } else if ("thisAndFuture".equalsIgnoreCase(mode) && date != null && !date.isBlank()) {
            // Strip existing UNTIL if any
            rule = rule.replaceAll(";?UNTIL=[^;]+", "");
            String newRule = rule + ";UNTIL=" + date;
            entry.setRecurrenceRule(newRule);
            calendarEntryRepository.save(entry);
        } else {
            calendarEntryRepository.delete(entry);
        }
    }

    private CalendarEntryResponse toResponse(CalendarEntry entry) {
        return new CalendarEntryResponse(
                entry.getId(),
                entry.getUserId(),
                entry.getEventId(),
                entry.getSpotId(),
                entry.getTitle(),
                entry.getDescription(),
                entry.getLocation(),
                entry.getStartTime(),
                entry.getEndTime(),
                entry.getRecurrenceRule(),
                entry.getColor(),
                entry.getCreatedAt()
        );
    }
}
