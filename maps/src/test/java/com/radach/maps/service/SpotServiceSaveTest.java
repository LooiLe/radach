package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.model.User;
import com.radach.maps.repository.UserRepository;

@SpringBootTest
@Transactional
public class SpotServiceSaveTest {

    @Autowired
    private SpotService spotService;

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testToggleSavePersists() {
        // 1. Create a User
        User user = new User();
        user.setEmail("test@example.com");
        user.setPasswordHash("hash");
        user.setName("Test");
        user.setRole(com.radach.maps.model.Role.USER);
        userRepository.saveAndFlush(user);

        // 2. Create a Spot
        SpotResponse spot = spotService.create(new SpotRequest(
            "Test Spot", "Park", "123 Test St", 40.0, -73.0, List.of("test"), List.of(), null, com.radach.maps.model.SpotStatus.ACTIVE
        ), true, user.getId());

        // 3. Save the spot
        SpotResponse response1 = spotService.toggleSave(spot.id(), user.getId());
        assertThat(response1.isSaved()).isTrue();

        // 4. Verify in getSavedSpots
        List<SpotResponse> savedSpots = spotService.getSavedSpots(user.getId());
        assertThat(savedSpots).hasSize(1);
        assertThat(savedSpots.get(0).id()).isEqualTo(spot.id());
        assertThat(savedSpots.get(0).isSaved()).isTrue();

        // 5. Verify in findSpots (which is what /spots calls)
        List<SpotResponse> allSpots = spotService.findSpots(null, null, null, "popularity", user.getId());
        SpotResponse foundSpot = allSpots.stream().filter(s -> s.id().equals(spot.id())).findFirst().orElseThrow();
        assertThat(foundSpot.isSaved()).isTrue();
    }

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Test
    public void testSerialization() throws Exception {
        SpotResponse spot = new SpotResponse(null, "Test", "Park", "123", 40.0, -73.0, List.of(), List.of(), null, "ACTIVE", 0, java.time.Instant.now(), 0.0, true, true, null, null, false, List.of());
        String json = objectMapper.writeValueAsString(spot);
        assertThat(json).contains("\"isSaved\":true");
    }
}
