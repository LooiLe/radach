package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ItineraryRequest;
import com.radach.maps.dto.ItineraryResponse;
import com.radach.maps.dto.StopRequest;
import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.model.Role;
import com.radach.maps.model.User;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.model.GenerationStatus;
import com.radach.maps.model.ItineraryGeneration;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.repository.ItineraryRepository;
import com.radach.maps.repository.ItineraryGenerationRepository;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
public class ItineraryServiceTest {

    @Autowired
    private ItineraryService itineraryService;

    @Autowired
    private SpotService spotService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private ItineraryGenerationRepository generationRepository;

    private User user;
    private SpotResponse spot1;
    private SpotResponse spot2;

    @BeforeEach
    public void setUp() {
        generationRepository.deleteAll();
        itineraryRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hash");
        user.setName("Itinerary User");
        user.setRole(Role.USER);
        user = userRepository.saveAndFlush(user);

        // Create spots
        spot1 = spotService.create(new SpotRequest(
            "Itinerary Spot 1", "Cafe", "123 Main St", 13.75, 100.5, List.of("cafe"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        spot2 = spotService.create(new SpotRequest(
            "Itinerary Spot 2", "Restaurant", "456 Food St", 13.76, 100.51, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());
    }

    @Test
    public void testCreateItineraryWithStops() {
        StopRequest stopReq1 = new StopRequest(spot1.id(), 1, "09:00", "10:00", 60, "Morning coffee");
        StopRequest stopReq2 = new StopRequest(spot2.id(), 2, "12:00", "13:30", 90, "Lunch break");

        ItineraryRequest request = new ItineraryRequest(
            "My Perfect Day",
            "This is my planned trip",
            "2026-06-01",
            List.of(stopReq1, stopReq2)
        );

        ItineraryResponse response = itineraryService.createItinerary(user.getId(), request);

        assertThat(response.id()).isNotNull();
        assertThat(response.userId()).isEqualTo(user.getId());
        assertThat(response.title()).isEqualTo("My Perfect Day");
        assertThat(response.description()).isEqualTo("This is my planned trip");
        assertThat(response.date()).isEqualTo(LocalDate.parse("2026-06-01"));
        assertThat(response.stops()).hasSize(2);
        assertThat(response.stopCount()).isEqualTo(2);

        assertThat(response.stops().get(0).spotId()).isEqualTo(spot1.id());
        assertThat(response.stops().get(0).notes()).isEqualTo("Morning coffee");
        assertThat(response.stops().get(0).startTime()).isEqualTo("09:00");

        assertThat(response.stops().get(1).spotId()).isEqualTo(spot2.id());
        assertThat(response.stops().get(1).notes()).isEqualTo("Lunch break");
        assertThat(response.stops().get(1).startTime()).isEqualTo("12:00");
    }

    @Test
    public void testUpdateItinerary() {
        ItineraryRequest initialReq = new ItineraryRequest("Old Title", "Old Desc", "2026-06-01", List.of());
        ItineraryResponse initial = itineraryService.createItinerary(user.getId(), initialReq);

        StopRequest stopReq = new StopRequest(spot1.id(), 1, "10:00", "11:00", 60, "Updated coffee stop");
        ItineraryRequest updateReq = new ItineraryRequest(
            "New Title",
            "New Desc",
            "2026-06-02",
            List.of(stopReq)
        );

        ItineraryResponse updated = itineraryService.updateItinerary(user.getId(), initial.id(), updateReq);

        assertThat(updated.title()).isEqualTo("New Title");
        assertThat(updated.description()).isEqualTo("New Desc");
        assertThat(updated.date()).isEqualTo(LocalDate.parse("2026-06-02"));
        assertThat(updated.stops()).hasSize(1);
        assertThat(updated.stops().get(0).spotId()).isEqualTo(spot1.id());
    }

    @Test
    public void testUpdateItineraryReplacesExistingStopsWithSameOrder() {
        StopRequest initialStop = new StopRequest(spot1.id(), 1, "09:00", "10:00", 60, "Initial coffee stop");
        ItineraryResponse initial = itineraryService.createItinerary(user.getId(),
                new ItineraryRequest("Title", "Desc", "2026-06-01", List.of(initialStop)));

        StopRequest updatedStop = new StopRequest(spot2.id(), 1, "12:00", "13:00", 60, "Updated lunch stop");
        ItineraryResponse updated = itineraryService.updateItinerary(user.getId(), initial.id(),
                new ItineraryRequest("Title", "Desc", "2026-06-01", List.of(updatedStop)));

        assertThat(updated.stops()).hasSize(1);
        assertThat(updated.stops().get(0).spotId()).isEqualTo(spot2.id());
        assertThat(updated.stops().get(0).stopOrder()).isEqualTo(1);
    }

    @Test
    public void testDeleteItinerary() {
        ItineraryRequest request = new ItineraryRequest("Title", "Desc", "2026-06-01", List.of());
        ItineraryResponse response = itineraryService.createItinerary(user.getId(), request);

        assertThat(itineraryRepository.existsById(response.id())).isTrue();

        itineraryService.deleteItinerary(user.getId(), response.id());

        assertThat(itineraryRepository.existsById(response.id())).isFalse();
    }

    @Test
    public void testDeleteGeneratedItineraryClearsGenerationReference() {
        ItineraryRequest request = new ItineraryRequest("Generated Title", "Desc", "2026-06-01", List.of());
        ItineraryResponse response = itineraryService.createItinerary(user.getId(), request);

        ItineraryGeneration generation = new ItineraryGeneration();
        generation.setUserId(user.getId());
        generation.setItineraryId(response.id());
        generation.setPreferences("{}");
        generation.setAmountCents(0);
        generation.setPaymentMethod("CREDITS");
        generation.setStatus(GenerationStatus.COMPLETED);
        generation = generationRepository.saveAndFlush(generation);

        itineraryService.deleteItinerary(user.getId(), response.id());

        assertThat(itineraryRepository.existsById(response.id())).isFalse();
        assertThat(generationRepository.findById(generation.getId()).orElseThrow().getItineraryId()).isNull();
    }

    @Test
    public void testAddAndRemoveStop() {
        ItineraryRequest request = new ItineraryRequest("Empty Itinerary", "No stops", "2026-06-01", List.of());
        ItineraryResponse itinerary = itineraryService.createItinerary(user.getId(), request);

        // Add stop
        StopRequest addReq = new StopRequest(spot1.id(), 1, "09:00", "10:00", 60, "First stop");
        ItineraryResponse updatedAfterAdd = itineraryService.addStop(user.getId(), itinerary.id(), addReq);
        assertThat(updatedAfterAdd.stops()).hasSize(1);
        
        Long stopId = updatedAfterAdd.stops().get(0).id();

        // Remove stop
        ItineraryResponse updatedAfterRemove = itineraryService.removeStop(user.getId(), itinerary.id(), stopId);
        assertThat(updatedAfterRemove.stops()).isEmpty();
    }

    @Test
    public void testReorderStops() {
        StopRequest stopReq1 = new StopRequest(spot1.id(), 1, "09:00", "10:00", 60, "Morning");
        StopRequest stopReq2 = new StopRequest(spot2.id(), 2, "11:00", "12:00", 60, "Noon");

        ItineraryRequest request = new ItineraryRequest(
            "Reorder Itinerary",
            "",
            "2026-06-01",
            List.of(stopReq1, stopReq2)
        );

        ItineraryResponse itinerary = itineraryService.createItinerary(user.getId(), request);
        assertThat(itinerary.stops()).hasSize(2);
        
        Long stop1Id = itinerary.stops().get(0).id();
        Long stop2Id = itinerary.stops().get(1).id();

        // Swap order
        ItineraryResponse reordered = itineraryService.reorderStops(user.getId(), itinerary.id(), List.of(stop2Id, stop1Id));
        
        assertThat(reordered.stops().get(0).id()).isEqualTo(stop2Id);
        assertThat(reordered.stops().get(0).stopOrder()).isEqualTo(1);
        assertThat(reordered.stops().get(1).id()).isEqualTo(stop1Id);
        assertThat(reordered.stops().get(1).stopOrder()).isEqualTo(2);
    }
}
