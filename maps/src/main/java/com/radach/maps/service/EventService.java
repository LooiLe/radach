package com.radach.maps.service;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.EventRequest;
import com.radach.maps.dto.EventResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.CalendarEntry;
import com.radach.maps.model.Event;
import com.radach.maps.model.EventLike;
import com.radach.maps.model.EventStatus;
import com.radach.maps.model.Spot;
import com.radach.maps.model.User;
import com.radach.maps.repository.CalendarEntryRepository;
import com.radach.maps.repository.EventLikeRepository;
import com.radach.maps.repository.EventRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final EventLikeRepository eventLikeRepository;
    private final CalendarEntryRepository calendarEntryRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;

    public EventService(EventRepository eventRepository,
                        EventLikeRepository eventLikeRepository,
                        CalendarEntryRepository calendarEntryRepository,
                        SpotRepository spotRepository,
                        UserRepository userRepository) {
        this.eventRepository = eventRepository;
        this.eventLikeRepository = eventLikeRepository;
        this.calendarEntryRepository = calendarEntryRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
    }

    /**
     * List upcoming ACTIVE events with optional filters.
     */
    public List<EventResponse> getUpcomingEvents(String city, Integer month, Integer year, Long currentUserId) {
        Instant now = Instant.now();

        // Determine date range
        Instant rangeStart;
        Instant rangeEnd;
        if (month != null && year != null) {
            YearMonth ym = YearMonth.of(year, month);
            rangeStart = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            rangeEnd = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } else if (year != null) {
            rangeStart = YearMonth.of(year, 1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            rangeEnd = YearMonth.of(year + 1, 1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } else {
            rangeStart = now;
            rangeEnd = now.plusSeconds(365L * 24 * 3600); // next year
        }

        List<Event> events;
        if (city != null && !city.isBlank()) {
            events = eventRepository.findByStatusAndCityAndTimeBetween(
                    EventStatus.ACTIVE.name(), city.trim(), rangeStart, rangeEnd);
        } else {
            events = eventRepository.findByStatusAndStartTimeBetween(
                    EventStatus.ACTIVE, rangeStart, rangeEnd);
        }

        return events.stream().map(e -> toResponse(e, currentUserId)).toList();
    }

    /**
     * Get events for a specific spot.
     */
    public List<EventResponse> getEventsForSpot(Long spotId, Long currentUserId) {
        List<Event> events = eventRepository.findBySpotIdAndStatusOrderByStartTimeAsc(spotId, EventStatus.ACTIVE);
        return events.stream().map(e -> toResponse(e, currentUserId)).toList();
    }

    /**
     * Get a single event.
     */
    public EventResponse getEvent(Long id, Long currentUserId) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        return toResponse(event, currentUserId);
    }

    /**
     * Submit a new event (PENDING for regular users, ACTIVE for admins).
     */
    public EventResponse submitEvent(EventRequest request, Long userId, boolean isAdmin) {
        if (!spotRepository.existsById(request.spotId())) {
            throw new ResourceNotFoundException("Spot not found");
        }

        Event event = new Event();
        event.setSpotId(request.spotId());
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setRecurrenceRule(request.recurrenceRule());
        event.setImageUrl(request.imageUrl());
        event.setSubmittedBy(userId);
        event.setStatus(isAdmin ? EventStatus.ACTIVE : EventStatus.PENDING);

        event = eventRepository.save(event);
        return toResponse(event, userId);
    }

    /**
     * Toggle like on an event. Returns the updated event.
     */
    @Transactional
    public EventResponse toggleLike(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        Optional<EventLike> existing = eventLikeRepository.findByUserIdAndEventId(userId, eventId);
        if (existing.isPresent()) {
            eventLikeRepository.delete(existing.get());
            event.setLikeCount(Math.max(0, event.getLikeCount() - 1));
        } else {
            EventLike like = new EventLike();
            like.setUserId(userId);
            like.setEventId(eventId);
            eventLikeRepository.save(like);
            event.setLikeCount(event.getLikeCount() + 1);
        }

        event = eventRepository.save(event);
        return toResponse(event, userId);
    }

    /**
     * Add an event to the user's calendar.
     */
    @Transactional
    public void addToCalendar(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        if (calendarEntryRepository.existsByUserIdAndEventId(userId, eventId)) {
            return; // already added
        }

        CalendarEntry entry = new CalendarEntry();
        entry.setUserId(userId);
        entry.setEventId(eventId);
        entry.setTitle(event.getTitle());
        entry.setDescription(event.getDescription());
        entry.setStartTime(event.getStartTime());
        entry.setEndTime(event.getEndTime());
        entry.setRecurrenceRule(event.getRecurrenceRule());
        entry.setColor("#4f8cff");
        calendarEntryRepository.save(entry);
    }

    // === Admin ===

    public List<EventResponse> getPendingEvents() {
        return eventRepository.findPending().stream()
                .map(e -> toResponse(e, null))
                .toList();
    }

    @Transactional
    public EventResponse updateEventStatus(Long id, EventStatus status) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        event.setStatus(status);
        event = eventRepository.save(event);
        return toResponse(event, null);
    }

    @Transactional
    public void deleteEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        eventLikeRepository.deleteByEventId(id);
        calendarEntryRepository.deleteByEventId(id);
        eventRepository.delete(event);
    }

    // === Helpers ===

    private EventResponse toResponse(Event event, Long currentUserId) {
        // Spot info
        String spotName = null;
        String spotAddress = null;
        Spot spot = spotRepository.findById(event.getSpotId()).orElse(null);
        if (spot != null) {
            spotName = spot.getName();
            spotAddress = spot.getAddress();
        }

        // Submitter name
        String submitterName = null;
        if (event.getSubmittedBy() != null) {
            submitterName = userRepository.findById(event.getSubmittedBy())
                    .map(User::getName).orElse(null);
        }

        // User-specific state
        boolean liked = false;
        boolean inCalendar = false;
        if (currentUserId != null) {
            liked = eventLikeRepository.existsByUserIdAndEventId(currentUserId, event.getId());
            inCalendar = calendarEntryRepository.existsByUserIdAndEventId(currentUserId, event.getId());
        }

        return new EventResponse(
                event.getId(),
                event.getSpotId(),
                spotName,
                spotAddress,
                event.getTitle(),
                event.getDescription(),
                event.getStartTime(),
                event.getEndTime(),
                event.getRecurrenceRule(),
                event.getImageUrl(),
                event.getStatus().name(),
                event.getSubmittedBy(),
                submitterName,
                event.getLikeCount(),
                liked,
                inCalendar,
                event.getCreatedAt()
        );
    }
}
