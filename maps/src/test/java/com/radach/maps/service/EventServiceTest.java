package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.radach.maps.dto.EventRequest;
import com.radach.maps.dto.EventResponse;
import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.EventStatus;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.repository.CalendarEntryRepository;
import com.radach.maps.repository.NotificationRepository;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
public class EventServiceTest {

    @Autowired
    private EventService eventService;

    @Autowired
    private SpotService spotService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private CalendarEntryRepository calendarEntryRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    private User user1;
    private User user2;
    private User admin;
    private SpotResponse spot;

    @BeforeEach
    public void setUp() {
        userRepository.deleteAll();

        user1 = new User();
        user1.setEmail("user1@example.com");
        user1.setPasswordHash("hash");
        user1.setName("User One");
        user1.setRole(Role.USER);
        user1 = userRepository.saveAndFlush(user1);

        user2 = new User();
        user2.setEmail("user2@example.com");
        user2.setPasswordHash("hash");
        user2.setName("User Two");
        user2.setRole(Role.USER);
        user2 = userRepository.saveAndFlush(user2);

        admin = new User();
        admin.setEmail("admin@example.com");
        admin.setPasswordHash("hash");
        admin.setName("Admin");
        admin.setRole(Role.ADMIN);
        admin = userRepository.saveAndFlush(admin);

        spot = spotService.create(new SpotRequest(
            "Event Test Spot", "Cafe", "456 Test Rd", 40.0, -73.0, List.of("test"), List.of(), null, SpotStatus.ACTIVE
        ), true, admin.getId());
    }

    @Test
    public void testSubmitEvent() {
        EventRequest request = new EventRequest(
            spot.id(),
            "My New Event",
            "Event Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // User submits -> PENDING
        EventResponse userEvent = eventService.submitEvent(request, user1.getId(), false);
        assertThat(userEvent.status()).isEqualTo(EventStatus.PENDING.name());
        assertThat(userEvent.submittedBy()).isEqualTo(user1.getId());

        // Admin submits -> ACTIVE
        EventResponse adminEvent = eventService.submitEvent(request, admin.getId(), true);
        assertThat(adminEvent.status()).isEqualTo(EventStatus.ACTIVE.name());
        assertThat(adminEvent.submittedBy()).isEqualTo(admin.getId());
    }

    @Test
    public void testUpdateUserEvent() {
        EventRequest request = new EventRequest(
            spot.id(),
            "My New Event",
            "Event Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        EventResponse event = eventService.submitEvent(request, user1.getId(), false);

        EventRequest updateRequest = new EventRequest(
            spot.id(),
            "Updated Title",
            "Updated Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // Try updating another user's event -> fails
        assertThatThrownBy(() -> eventService.updateUserEvent(event.id(), updateRequest, user2.getId(), false))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("You can only edit your own events");

        // Owner updates -> success and remains/reverts to PENDING
        EventResponse updatedEvent = eventService.updateUserEvent(event.id(), updateRequest, user1.getId(), false);
        assertThat(updatedEvent.title()).isEqualTo("Updated Title");
        assertThat(updatedEvent.description()).isEqualTo("Updated Description");
        assertThat(updatedEvent.status()).isEqualTo(EventStatus.PENDING.name());
    }

    @Test
    public void testUpdateActiveUserEventRevertsToPending() {
        EventRequest request = new EventRequest(
            spot.id(),
            "My New Event",
            "Event Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // Submit as admin -> ACTIVE
        EventResponse event = eventService.submitEvent(request, user1.getId(), true);
        assertThat(event.status()).isEqualTo(EventStatus.ACTIVE.name());

        EventRequest updateRequest = new EventRequest(
            spot.id(),
            "Updated Title",
            "Updated Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // User updates active event -> reverts to PENDING
        EventResponse updatedEvent = eventService.updateUserEvent(event.id(), updateRequest, user1.getId(), false);
        assertThat(updatedEvent.status()).isEqualTo(EventStatus.PENDING.name());
    }

    @Test
    public void testAdminUpdateUserEventDoesNotRevert() {
        EventRequest request = new EventRequest(
            spot.id(),
            "My New Event",
            "Event Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // Submit as admin -> ACTIVE
        EventResponse event = eventService.submitEvent(request, user1.getId(), true);
        assertThat(event.status()).isEqualTo(EventStatus.ACTIVE.name());

        EventRequest updateRequest = new EventRequest(
            spot.id(),
            "Updated Title",
            "Updated Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        // Admin updates active event -> remains ACTIVE
        EventResponse updatedEvent = eventService.updateUserEvent(event.id(), updateRequest, admin.getId(), true);
        assertThat(updatedEvent.status()).isEqualTo(EventStatus.ACTIVE.name());
    }

    @Test
    public void testDeleteUserEvent() {
        EventRequest request = new EventRequest(
            spot.id(),
            "My New Event",
            "Event Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            List.of("http://example.com/image.png")
        );

        EventResponse event = eventService.submitEvent(request, user1.getId(), false);

        // Try deleting another user's event -> fails
        assertThatThrownBy(() -> eventService.deleteUserEvent(event.id(), user2.getId(), false))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("You can only delete your own events");

        // Owner deletes -> success
        eventService.deleteUserEvent(event.id(), user1.getId(), false);

        assertThatThrownBy(() -> eventService.getEvent(event.id(), user1.getId()))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    public void testUpcomingEventsSortingByTrending() {
        // Create 3 active events
        EventResponse eventA = eventService.submitEvent(new EventRequest(
            spot.id(), "Event A", "Desc A", Instant.now().plusSeconds(3600), Instant.now().plusSeconds(7200), null, null
        ), admin.getId(), true);
        
        EventResponse eventB = eventService.submitEvent(new EventRequest(
            spot.id(), "Event B", "Desc B", Instant.now().plusSeconds(7200), Instant.now().plusSeconds(10800), null, null
        ), admin.getId(), true);
        
        EventResponse eventC = eventService.submitEvent(new EventRequest(
            spot.id(), "Event C", "Desc C", Instant.now().plusSeconds(10800), Instant.now().plusSeconds(14400), null, null
        ), admin.getId(), true);

        // 1. Global trending test (no user context)
        // Event A: Liked by user1 (weight 5)
        eventService.toggleLike(eventA.id(), user1.getId());
        
        // Event B: Calendar added by user1 (weight 10)
        eventService.toggleCalendar(eventB.id(), user1.getId());
        
        // Event C: No interactions (weight 0)

        // Fetch global trending
        List<EventResponse> globalTrending = eventService.getUpcomingEvents(null, null, null, "trending", null);
        assertThat(globalTrending).hasSize(3);
        assertThat(globalTrending.get(0).id()).isEqualTo(eventB.id()); // 10 score
        assertThat(globalTrending.get(1).id()).isEqualTo(eventA.id()); // 5 score
        assertThat(globalTrending.get(2).id()).isEqualTo(eventC.id()); // 0 score

        // 2. Personalized trending test (user1 has user2 as friend)
        var friendship = friendshipService.sendRequest(user1.getId(), user2.getId());
        friendshipService.acceptRequest(user2.getId(), friendship.getId());

        // Event C: Liked by user2 (1st-degree friend of user1, weight 5 * 5 = 25 points)
        eventService.toggleLike(eventC.id(), user2.getId());

        // Fetch trending personalized for user1
        List<EventResponse> personalizedTrending = eventService.getUpcomingEvents(null, null, null, "trending", user1.getId());
        assertThat(personalizedTrending).hasSize(3);
        assertThat(personalizedTrending.get(0).id()).isEqualTo(eventC.id()); // 25 score
        assertThat(personalizedTrending.get(1).id()).isEqualTo(eventA.id()); // 0 score (user1's own like is not in connection weights, fallback to date order)
        assertThat(personalizedTrending.get(2).id()).isEqualTo(eventB.id()); // 0 score (user1's own calendar is not in connection weights, fallback to date order)
    }

    @Test
    public void testUpcomingEventsMonthOnlyFilter() {
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC);
        java.time.ZonedDateTime target = now.plusDays(2);
        if (target.getYear() != now.getYear()) {
            target = now.plusHours(2);
        }
        int targetMonth = target.getMonthValue();
        Instant eventStart = target.toInstant();
        Instant eventEnd = target.plusHours(2).toInstant();

        EventResponse eventA = eventService.submitEvent(new EventRequest(
            spot.id(), "Upcoming Month Event", "Desc", eventStart, eventEnd, null, null
        ), admin.getId(), true);

        // Fetch events for targetMonth, year = null (defaults to current year)
        List<EventResponse> events = eventService.getUpcomingEvents(null, targetMonth, null, "date", null);
        
        // Assert we got our Upcoming Month Event
        assertThat(events).hasSize(1);
        assertThat(events.get(0).id()).isEqualTo(eventA.id());
    }

    @Test
    public void testUpcomingEventsIncludesPastRecurringEvents() {
        // Create an event that starts 2 days ago but repeats monthly
        Instant pastRecurringStart = Instant.now().minus(java.time.Duration.ofDays(2));
        Instant pastRecurringEnd = pastRecurringStart.plusSeconds(7200);
        EventResponse recurringEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Past Recurring Event", "Desc", pastRecurringStart, pastRecurringEnd, "FREQ=MONTHLY", null
        ), admin.getId(), true);

        // Create an event that starts 2 days ago but does NOT repeat
        Instant pastNonRecurringStart = Instant.now().minus(java.time.Duration.ofDays(2));
        Instant pastNonRecurringEnd = pastNonRecurringStart.plusSeconds(7200);
        EventResponse nonRecurringEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Past Non-Recurring Event", "Desc", pastNonRecurringStart, pastNonRecurringEnd, null, null
        ), admin.getId(), true);

        // Fetch upcoming events
        List<EventResponse> events = eventService.getUpcomingEvents(null, null, null, "date", null);

        // Assert that recurring event is included, and non-recurring is excluded
        List<Long> eventIds = events.stream().map(EventResponse::id).toList();
        assertThat(eventIds).contains(recurringEvent.id());
        assertThat(eventIds).doesNotContain(nonRecurringEvent.id());
    }

    @Test
    public void testUpcomingEventsExcludesFinishedOneOffAndRecurringEvents() {
        // 1. One-off event in the past (starts 5 days ago, ends 4 days ago)
        Instant pastOneOffStart = Instant.now().minus(java.time.Duration.ofDays(5));
        Instant pastOneOffEnd = pastOneOffStart.plusSeconds(7200);
        EventResponse pastOneOffEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Past One-Off Event", "Desc", pastOneOffStart, pastOneOffEnd, null, null
        ), admin.getId(), true);

        // 2. Recurring event that has ended (starts 10 days ago, ended 5 days ago via UNTIL)
        Instant pastRecurringStart = Instant.now().minus(java.time.Duration.ofDays(10));
        Instant pastRecurringEnd = pastRecurringStart.plusSeconds(7200);
        // Formatted date for UNTIL (5 days ago in UTC)
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(java.time.ZoneOffset.UTC);
        String untilStr = fmt.format(Instant.now().minus(java.time.Duration.ofDays(5)));
        EventResponse finishedRecurringEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Finished Recurring Event", "Desc", pastRecurringStart, pastRecurringEnd, "FREQ=DAILY;UNTIL=" + untilStr, null
        ), admin.getId(), true);

        // 3. Active recurring event (starts 10 days ago, has no UNTIL, repeats daily)
        EventResponse activeRecurringEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Active Recurring Event", "Desc", pastRecurringStart, pastRecurringEnd, "FREQ=DAILY", null
        ), admin.getId(), true);

        // Fetch upcoming events
        List<EventResponse> events = eventService.getUpcomingEvents(null, null, null, "date", null);
        List<Long> eventIds = events.stream().map(EventResponse::id).toList();

        // Assertions
        assertThat(eventIds).doesNotContain(pastOneOffEvent.id());
        assertThat(eventIds).doesNotContain(finishedRecurringEvent.id());
        assertThat(eventIds).contains(activeRecurringEvent.id());
    }

    @Test
    public void testGetEventsForSpotExcludesFinishedEvents() {
        // One-off event in the past (starts 5 days ago, ends 4 days ago)
        Instant pastOneOffStart = Instant.now().minus(java.time.Duration.ofDays(5));
        Instant pastOneOffEnd = pastOneOffStart.plusSeconds(7200);
        EventResponse pastOneOffEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Past One-Off Event", "Desc", pastOneOffStart, pastOneOffEnd, null, null
        ), admin.getId(), true);

        // Future event
        EventResponse futureEvent = eventService.submitEvent(new EventRequest(
            spot.id(), "Future Event", "Desc", Instant.now().plusSeconds(3600), Instant.now().plusSeconds(7200), null, null
        ), admin.getId(), true);

        // Fetch events for spot
        List<EventResponse> events = eventService.getEventsForSpot(spot.id(), null);
        List<Long> eventIds = events.stream().map(EventResponse::id).toList();

        // Assertions
        assertThat(eventIds).doesNotContain(pastOneOffEvent.id());
        assertThat(eventIds).contains(futureEvent.id());
    }

    @Test
    public void testEventChangeNotifications() {
        EventResponse event = eventService.submitEvent(new EventRequest(
            spot.id(), "Initial Title", "Desc", Instant.now().plusSeconds(3600), Instant.now().plusSeconds(7200), null, null
        ), user1.getId(), true);

        eventService.toggleCalendar(event.id(), user2.getId());

        assertThat(calendarEntryRepository.existsByUserIdAndEventId(user2.getId(), event.id())).isTrue();

        EventRequest updateRequest = new EventRequest(
            spot.id(), "New Title", "New Desc", Instant.now().plusSeconds(3600), Instant.now().plusSeconds(7200), null, null
        );
        eventService.updateUserEvent(event.id(), updateRequest, admin.getId(), true);

        List<com.radach.maps.model.CalendarEntry> entries = calendarEntryRepository.findByEventId(event.id());
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getTitle()).isEqualTo("New Title");
        assertThat(entries.get(0).getDescription()).isEqualTo("New Desc");

        List<com.radach.maps.model.Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user2.getId());
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getType()).isEqualTo("EVENT_CHANGE");
        assertThat(notifications.get(0).getMessage()).contains("updated");
        assertThat(notifications.get(0).getReferenceId()).isEqualTo(event.id());
        assertThat(notifications.get(0).getReferenceType()).isEqualTo("EVENT");

        notificationRepository.deleteAll();

        eventService.updateEventStatus(event.id(), EventStatus.REJECTED);
        
        notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user2.getId());
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getType()).isEqualTo("EVENT_CHANGE");
        assertThat(notifications.get(0).getMessage()).contains("cancelled/removed");

        notificationRepository.deleteAll();

        eventService.deleteUserEvent(event.id(), user1.getId(), false);

        notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user2.getId());
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getType()).isEqualTo("EVENT_CHANGE");
        assertThat(notifications.get(0).getMessage()).contains("deleted");

        assertThat(calendarEntryRepository.existsByUserIdAndEventId(user2.getId(), event.id())).isFalse();
    }
}
