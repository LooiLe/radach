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
import java.util.Set;
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
    private final FriendshipService friendshipService;
    private final NotificationService notificationService;

    public EventService(EventRepository eventRepository,
                        EventLikeRepository eventLikeRepository,
                        CalendarEntryRepository calendarEntryRepository,
                        SpotRepository spotRepository,
                        UserRepository userRepository,
                        FriendshipService friendshipService,
                        NotificationService notificationService) {
        this.eventRepository = eventRepository;
        this.eventLikeRepository = eventLikeRepository;
        this.calendarEntryRepository = calendarEntryRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.friendshipService = friendshipService;
        this.notificationService = notificationService;
    }

    /**
     * List upcoming ACTIVE events with optional filters.
     */
    public List<EventResponse> getUpcomingEvents(String city, Integer month, Integer year, String sortBy, Long currentUserId) {
        Instant now = Instant.now();

        Instant rangeStart;
        Instant rangeEnd;
        if (month != null) {
            int queryYear = (year != null) ? year : java.time.LocalDate.now(java.time.ZoneOffset.UTC).getYear();
            YearMonth ym = YearMonth.of(queryYear, month);
            rangeStart = ym.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            rangeEnd = ym.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } else if (year != null) {
            rangeStart = YearMonth.of(year, 1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            rangeEnd = YearMonth.of(year + 1, 1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } else {
            rangeStart = now;
            rangeEnd = now.plusSeconds(10L * 365 * 24 * 3600); // 10 years
        }

        List<Event> events;
        boolean sortTrending = "trending".equalsIgnoreCase(sortBy);

        if (sortTrending) {
            Instant since = now.minus(java.time.Duration.ofDays(7));
            Set<Long> firstDegree = Set.of();
            Set<Long> secondDegree = Set.of();
            if (currentUserId != null) {
                firstDegree = friendshipService.getFirstDegreeConnections(currentUserId);
                secondDegree = friendshipService.getSecondDegreeConnections(currentUserId);
            }

            if (!firstDegree.isEmpty() || !secondDegree.isEmpty()) {
                Set<Long> safeFirstDegree = firstDegree.isEmpty() ? Set.of(-1L) : firstDegree;
                Set<Long> safeSecondDegree = secondDegree.isEmpty() ? Set.of(-1L) : secondDegree;
                if (city != null && !city.isBlank()) {
                    events = eventRepository.findPersonalizedTrendingByStatusAndCityAndTimeBetween(
                            EventStatus.ACTIVE.name(), city.trim(), rangeStart, rangeEnd, safeFirstDegree, safeSecondDegree, since);
                } else {
                    events = eventRepository.findPersonalizedTrendingByStatusAndTimeBetween(
                            EventStatus.ACTIVE.name(), rangeStart, rangeEnd, safeFirstDegree, safeSecondDegree, since);
                }
            } else {
                if (city != null && !city.isBlank()) {
                    events = eventRepository.findByStatusAndCityAndTimeBetweenOrderByTrendingDesc(
                            EventStatus.ACTIVE.name(), city.trim(), rangeStart, rangeEnd, since);
                } else {
                    events = eventRepository.findByStatusAndTimeBetweenOrderByTrendingDesc(
                            EventStatus.ACTIVE.name(), rangeStart, rangeEnd, since);
                }
            }
        } else {
            if (city != null && !city.isBlank()) {
                events = eventRepository.findByStatusAndCityAndTimeBetween(
                        EventStatus.ACTIVE.name(), city.trim(), rangeStart, rangeEnd);
            } else {
                events = eventRepository.findByStatusAndStartTimeBetween(
                        EventStatus.ACTIVE, rangeStart, rangeEnd);
            }
        }

        return events.stream()
                .filter(e -> !isEventEnded(e, now))
                .map(e -> toResponse(e, currentUserId))
                .toList();
    }

    /**
     * Get events for a specific spot.
     */
    public List<EventResponse> getEventsForSpot(Long spotId, Long currentUserId) {
        List<Event> events = eventRepository.findBySpotIdAndStatusOrderByStartTimeAsc(spotId, EventStatus.ACTIVE);
        Instant now = Instant.now();
        return events.stream()
                .filter(e -> !isEventEnded(e, now))
                .map(e -> toResponse(e, currentUserId))
                .toList();
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
        event.setImageUrls(request.imageUrls() != null ? request.imageUrls() : new java.util.ArrayList<>());
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
     * Toggle an event in the user's calendar.
     */
    @Transactional
    public EventResponse toggleCalendar(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        if (calendarEntryRepository.existsByUserIdAndEventId(userId, eventId)) {
            calendarEntryRepository.deleteByUserIdAndEventId(userId, eventId);
        } else {
            CalendarEntry entry = new CalendarEntry();
            entry.setUserId(userId);
            entry.setEventId(eventId);
            entry.setSpotId(event.getSpotId());
            entry.setTitle(event.getTitle());
            entry.setDescription(event.getDescription());
            entry.setLocation(getEventLocation(event));
            entry.setStartTime(event.getStartTime());
            entry.setEndTime(event.getEndTime());
            entry.setRecurrenceRule(event.getRecurrenceRule());
            entry.setColor("#4f8cff");
            calendarEntryRepository.save(entry);
        }
        return toResponse(event, userId);
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
        EventStatus oldStatus = event.getStatus();
        event.setStatus(status);
        event = eventRepository.save(event);
        if (oldStatus != status) {
            updateCalendarEntriesAndNotify(event, "STATUS_" + status.name(), null);
        }
        return toResponse(event, null);
    }

    @Transactional
    public EventResponse updateEvent(Long id, EventRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));
        
        // Find deleted photos to clean up disk
        List<String> oldPhotos = event.getImageUrls() == null ? List.of() : event.getImageUrls();
        List<String> newPhotos = request.imageUrls() == null ? List.of() : request.imageUrls();
        
        for (String oldPhoto : oldPhotos) {
            if (!newPhotos.contains(oldPhoto)) {
                if (oldPhoto != null && oldPhoto.startsWith("/uploads/")) {
                    String filename = oldPhoto.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get("uploads").resolve(filename));
                        } catch (java.io.IOException e) {
                            System.err.println("Failed to delete removed photo during update: " + oldPhoto);
                        }
                    }
                }
            }
        }

        boolean detailsChanged = !java.util.Objects.equals(event.getTitle(), request.title())
                || !java.util.Objects.equals(event.getDescription(), request.description())
                || !java.util.Objects.equals(event.getStartTime(), request.startTime())
                || !java.util.Objects.equals(event.getEndTime(), request.endTime())
                || !java.util.Objects.equals(event.getRecurrenceRule(), request.recurrenceRule());

        if (request.spotId() != null) event.setSpotId(request.spotId());
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setRecurrenceRule(request.recurrenceRule());
        if (request.imageUrls() != null) event.setImageUrls(request.imageUrls());
        
        event = eventRepository.save(event);
        if (detailsChanged) {
            updateCalendarEntriesAndNotify(event, "DETAILS", null);
        }
        return toResponse(event, null);
    }

    @Transactional
    public void deleteEvent(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        // Delete associated photos from disk
        if (event.getImageUrls() != null) {
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads");
            for (String photoUrl : event.getImageUrls()) {
                if (photoUrl != null && photoUrl.startsWith("/uploads/")) {
                    String filename = photoUrl.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(uploadDir.resolve(filename));
                        } catch (java.io.IOException e) {
                            System.err.println("Failed to delete photo: " + photoUrl);
                        }
                    }
                }
            }
        }

        notifyCalendarDeletion(event, null);
        eventLikeRepository.deleteByEventId(id);
        calendarEntryRepository.deleteByEventId(id);
        eventRepository.delete(event);
    }

    public List<EventResponse> getEventsSubmittedBy(Long userId) {
        List<Event> events = eventRepository.findBySubmittedByOrderByCreatedAtDesc(userId);
        return events.stream().map(e -> toResponse(e, userId)).toList();
    }

    @Transactional
    public EventResponse updateUserEvent(Long id, EventRequest request, Long userId, boolean isAdmin) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        if (!isAdmin) {
            if (event.getSubmittedBy() == null || !event.getSubmittedBy().equals(userId)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.FORBIDDEN,
                        "You can only edit your own events"
                );
            }
            // Reset status to PENDING for regular users upon edit
            event.setStatus(EventStatus.PENDING);
        }

        // Find deleted photos to clean up disk
        List<String> oldPhotos = event.getImageUrls() == null ? List.of() : event.getImageUrls();
        List<String> newPhotos = request.imageUrls() == null ? List.of() : request.imageUrls();
        
        for (String oldPhoto : oldPhotos) {
            if (!newPhotos.contains(oldPhoto)) {
                if (oldPhoto != null && oldPhoto.startsWith("/uploads/")) {
                    String filename = oldPhoto.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get("uploads").resolve(filename));
                        } catch (java.io.IOException e) {
                            System.err.println("Failed to delete removed photo during update: " + oldPhoto);
                        }
                    }
                }
            }
        }

        boolean detailsChanged = !java.util.Objects.equals(event.getTitle(), request.title())
                || !java.util.Objects.equals(event.getDescription(), request.description())
                || !java.util.Objects.equals(event.getStartTime(), request.startTime())
                || !java.util.Objects.equals(event.getEndTime(), request.endTime())
                || !java.util.Objects.equals(event.getRecurrenceRule(), request.recurrenceRule());

        EventStatus oldStatus = event.getStatus();

        if (request.spotId() != null) {
            if (!spotRepository.existsById(request.spotId())) {
                throw new ResourceNotFoundException("Spot not found");
            }
            event.setSpotId(request.spotId());
        }
        event.setTitle(request.title());
        event.setDescription(request.description());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setRecurrenceRule(request.recurrenceRule());
        event.setImageUrls(request.imageUrls() != null ? request.imageUrls() : new java.util.ArrayList<>());

        event = eventRepository.save(event);

        if (detailsChanged) {
            updateCalendarEntriesAndNotify(event, "DETAILS", userId);
        } else if (oldStatus != event.getStatus()) {
            updateCalendarEntriesAndNotify(event, "STATUS_" + event.getStatus().name(), userId);
        }

        return toResponse(event, userId);
    }

    @Transactional
    public void deleteUserEvent(Long id, Long userId, boolean isAdmin) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found"));

        if (!isAdmin) {
            if (event.getSubmittedBy() == null || !event.getSubmittedBy().equals(userId)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.FORBIDDEN,
                        "You can only delete your own events"
                );
            }
        }

        // Delete associated photos from disk
        if (event.getImageUrls() != null) {
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads");
            for (String photoUrl : event.getImageUrls()) {
                if (photoUrl != null && photoUrl.startsWith("/uploads/")) {
                    String filename = photoUrl.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(uploadDir.resolve(filename));
                        } catch (java.io.IOException e) {
                            System.err.println("Failed to delete photo: " + photoUrl);
                        }
                    }
                }
            }
        }

        notifyCalendarDeletion(event, userId);
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

        String responseStatus = event.getStatus().name();
        if (event.getStatus() == EventStatus.ACTIVE && isEventEnded(event, Instant.now())) {
            responseStatus = "ENDED";
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
                event.getImageUrls(),
                responseStatus,
                event.getSubmittedBy(),
                submitterName,
                event.getLikeCount(),
                liked,
                inCalendar,
                event.getCreatedAt()
        );
    }

    private boolean isEventEnded(Event event, Instant now) {
        if (event.getRecurrenceRule() == null || event.getRecurrenceRule().isBlank()) {
            Instant end = event.getEndTime() != null ? event.getEndTime() : event.getStartTime();
            return end != null && end.isBefore(now);
        } else {
            String rule = event.getRecurrenceRule();
            if (rule.contains("UNTIL=")) {
                int index = rule.indexOf("UNTIL=");
                String sub = rule.substring(index + 6);
                int endOfUntil = sub.indexOf(";");
                String untilStr = endOfUntil != -1 ? sub.substring(0, endOfUntil) : sub;
                try {
                    Instant untilInstant;
                    if (untilStr.endsWith("Z")) {
                        untilStr = untilStr.substring(0, untilStr.length() - 1);
                    }
                    if (untilStr.contains("T")) {
                        java.time.LocalDateTime ldt = java.time.LocalDateTime.parse(
                                untilStr,
                                java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss")
                        );
                        untilInstant = ldt.toInstant(ZoneOffset.UTC);
                    } else {
                        java.time.LocalDate ld = java.time.LocalDate.parse(
                                untilStr,
                                java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd")
                        );
                        untilInstant = ld.atTime(23, 59, 59).atZone(ZoneOffset.UTC).toInstant();
                    }
                    return untilInstant.isBefore(now);
                } catch (Exception ex) {
                    return false;
                }
            }
            return false;
        }
    }

    private void updateCalendarEntriesAndNotify(Event event, String updateType, Long triggerUserId) {
        List<CalendarEntry> entries = calendarEntryRepository.findByEventId(event.getId());
        for (CalendarEntry entry : entries) {
            entry.setTitle(event.getTitle());
            entry.setDescription(event.getDescription());
            entry.setLocation(getEventLocation(event));
            entry.setSpotId(event.getSpotId());
            entry.setStartTime(event.getStartTime());
            entry.setEndTime(event.getEndTime());
            entry.setRecurrenceRule(event.getRecurrenceRule());
            calendarEntryRepository.save(entry);

            String message = "Event '" + event.getTitle() + "' in your calendar has been updated.";
            if ("STATUS_REJECTED".equals(updateType)) {
                message = "Event '" + event.getTitle() + "' in your calendar has been cancelled/removed.";
            } else if ("STATUS_ACTIVE".equals(updateType)) {
                message = "Event '" + event.getTitle() + "' in your calendar is now active.";
            }

            notificationService.createNotification(
                    entry.getUserId(),
                    "EVENT_CHANGE",
                    message,
                    event.getId(),
                    "EVENT"
            );
        }
    }

    private void notifyCalendarDeletion(Event event, Long triggerUserId) {
        List<CalendarEntry> entries = calendarEntryRepository.findByEventId(event.getId());
        for (CalendarEntry entry : entries) {
            String message = "Event '" + event.getTitle() + "' in your calendar has been deleted.";
            notificationService.createNotification(
                    entry.getUserId(),
                    "EVENT_CHANGE",
                    message,
                    event.getId(),
                    "EVENT"
            );
        }
    }

    private String getEventLocation(Event event) {
        return spotRepository.findById(event.getSpotId())
                .map(Spot::getAddress)
                .orElse(null);
    }
}

