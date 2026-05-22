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
            "http://example.com/image.png"
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
            "http://example.com/image.png"
        );

        EventResponse event = eventService.submitEvent(request, user1.getId(), false);

        EventRequest updateRequest = new EventRequest(
            spot.id(),
            "Updated Title",
            "Updated Description",
            Instant.now().plusSeconds(3600),
            Instant.now().plusSeconds(7200),
            null,
            "http://example.com/image.png"
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
            "http://example.com/image.png"
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
            "http://example.com/image.png"
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
            "http://example.com/image.png"
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
            "http://example.com/image.png"
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
            "http://example.com/image.png"
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
}
