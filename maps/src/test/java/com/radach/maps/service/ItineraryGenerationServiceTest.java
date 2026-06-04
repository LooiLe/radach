package com.radach.maps.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.GenerateItineraryRequest;
import com.radach.maps.dto.GenerationResponse;
import com.radach.maps.dto.ItineraryResponse;
import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.model.*;
import com.radach.maps.repository.*;
import com.stripe.model.checkout.Session;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
public class ItineraryGenerationServiceTest {

    @Autowired
    private ItineraryGenerationService generationService;

    @Autowired
    private SpotService spotService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private ItineraryStopRepository stopRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private ItineraryService itineraryService;

    @Autowired
    private UserCreditsRepository creditsRepository;

    @Autowired
    private UserSubscriptionRepository subscriptionRepository;

    @MockBean
    private StripeService stripeService;

    private User user;
    private SpotResponse cafeSpot;
    private SpotResponse foodSpot;
    private SpotResponse hotelSpot;
    private SpotResponse barSpot;

    @BeforeEach
    public void setUp() throws Exception {
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        creditsRepository.deleteAll();
        subscriptionRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setEmail("generator@example.com");
        user.setPasswordHash("hash");
        user.setName("Generator User");
        user.setRole(Role.USER);
        user = userRepository.saveAndFlush(user);

        // Create spots with matching types
        cafeSpot = spotService.create(new SpotRequest(
            "Central Cafe", "Cafe", "123 Main St", 13.75, 100.5, List.of("cafe"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        foodSpot = spotService.create(new SpotRequest(
            "Central Restaurant", "Restaurant", "456 Food St", 13.76, 100.51, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        hotelSpot = spotService.create(new SpotRequest(
            "Central Hotel", "Hotel", "789 Stay St", 13.77, 100.52, List.of("hotel"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        barSpot = spotService.create(new SpotRequest(
            "Central Bar", "Bar", "999 Night St", 13.78, 100.53, List.of("bar"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        // Setup Stripe Service mock responses
        when(stripeService.isConfigured()).thenReturn(true);
        when(stripeService.getItineraryPriceCents()).thenReturn(199);
        
        Session mockSession = new Session();
        mockSession.setId("sess_test_123");
        mockSession.setUrl("https://checkout.stripe.com/pay/test");
        when(stripeService.createOneTimeCheckoutSession(any(Long.class), any(Long.class), any())).thenReturn(mockSession);
    }

    @Test
    public void testInitiateOneTimePaymentFlow() {
        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Cafe", "Restaurant"),
            "EXPERT",
            "2026-06-01",
            3,
            13.75,
            100.5,
            10.0,
            "ONE_TIME"
        );

        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.id()).isNotNull();
        assertThat(response.status()).isEqualTo(GenerationStatus.PENDING_PAYMENT.name());
        assertThat(response.paymentMethod()).isEqualTo("ONE_TIME");
        assertThat(response.amountCents()).isEqualTo(199);
        assertThat(response.checkoutUrl()).isEqualTo("https://checkout.stripe.com/pay/test");
    }

    @Test
    public void testInitiateWithCreditsDeduction() {
        // Grant credits to user
        UserCredits uc = new UserCredits();
        uc.setUserId(user.getId());
        uc.setBalance(5);
        creditsRepository.saveAndFlush(uc);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Cafe", "Restaurant"),
            "EXPERT",
            "2026-06-01",
            2,
            13.75,
            100.5,
            10.0,
            "CREDITS"
        );

        // Generates immediately
        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.id()).isNotNull();
        // Since it runs immediately and candidates exist, it should succeed
        assertThat(response.status()).isEqualTo(GenerationStatus.COMPLETED.name());
        assertThat(response.paymentMethod()).isEqualTo("CREDITS");
        assertThat(response.itineraryId()).isNotNull();

        // Check credit balance was decremented
        UserCredits updatedCredits = creditsRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(updatedCredits.getBalance()).isEqualTo(4);

        // Check generated itinerary
        Itinerary itinerary = itineraryRepository.findById(response.itineraryId()).orElseThrow();
        assertThat(itinerary.getSource()).isEqualTo(ItinerarySource.GENERATED);
        assertThat(itinerary.getUserId()).isEqualTo(user.getId());
    }

    @Test
    public void testInitiateWithSubscriptionUsage() {
        // Grant PRO subscription to user
        UserSubscription sub = new UserSubscription();
        sub.setUserId(user.getId());
        sub.setTier(SubscriptionTier.PRO);
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setGenerationsUsedThisMonth(1);
        sub.setGenerationsLimit(5);
        subscriptionRepository.saveAndFlush(sub);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Cafe", "Restaurant"),
            "EXPERT",
            "2026-06-01",
            2,
            13.75,
            100.5,
            10.0,
            "SUBSCRIPTION"
        );

        // Generates immediately
        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.id()).isNotNull();
        assertThat(response.status()).isEqualTo(GenerationStatus.COMPLETED.name());
        assertThat(response.paymentMethod()).isEqualTo("SUBSCRIPTION");
        assertThat(response.itineraryId()).isNotNull();

        // Check subscription generation counter was incremented
        UserSubscription updatedSub = subscriptionRepository.findByUserIdAndStatus(user.getId(), SubscriptionStatus.ACTIVE).orElseThrow();
        assertThat(updatedSub.getGenerationsUsedThisMonth()).isEqualTo(2);
    }

    @Test
    public void testGeneratedScheduleUsesCategoryTimingRules() {
        UserCredits uc = new UserCredits();
        uc.setUserId(user.getId());
        uc.setBalance(5);
        creditsRepository.saveAndFlush(uc);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Cafe", "Restaurant", "Bar", "Hotel"),
            "EXPERT",
            "2026-06-01",
            4,
            13.75,
            100.5,
            10.0,
            "CREDITS"
        );

        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.status()).isEqualTo(GenerationStatus.COMPLETED.name());

        List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(response.itineraryId());
        assertThat(stops).hasSize(4);
        assertThat(stops.get(0).getSpotId()).isEqualTo(cafeSpot.id());
        assertThat(stops.get(1).getSpotId()).isEqualTo(foodSpot.id());
        assertThat(stops.get(2).getSpotId()).isEqualTo(barSpot.id());
        assertThat(stops.get(3).getSpotId()).isEqualTo(hotelSpot.id());
        assertThat(stops.get(0).getStartTime().toString()).isEqualTo("09:00");
        assertThat(stops.get(1).getStartTime().toString()).isEqualTo("12:30");
        assertThat(stops.get(2).getStartTime().toString()).isEqualTo("20:30");
        assertThat(stops.get(3).getStartTime().toString()).isEqualTo("22:07");
    }

    @Test
    public void testBalancedCategoryPreferenceKeepsRouteVaried() {
        UserCredits uc = new UserCredits();
        uc.setUserId(user.getId());
        uc.setBalance(5);
        creditsRepository.saveAndFlush(uc);

        spotService.create(new SpotRequest(
            "Second Restaurant", "Restaurant", "222 Food St", 13.755, 100.505, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());
        spotService.create(new SpotRequest(
            "Third Restaurant", "Restaurant", "333 Food St", 13.765, 100.515, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Restaurant"),
            "EXPERT",
            "2026-06-01",
            4,
            13.75,
            100.5,
            10.0,
            "CREDITS",
            false,
            null
        );

        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.status()).isEqualTo(GenerationStatus.COMPLETED.name());
        List<String> stopTypes = getGeneratedStopTypes(response.itineraryId());
        assertThat(stopTypes).hasSize(4);
        assertThat(stopTypes).contains("Restaurant");
        assertThat(stopTypes).anyMatch(type -> !type.equalsIgnoreCase("Restaurant"));
    }

    @Test
    public void testStrictCategoryPreferenceUsesOnlySelectedTypes() {
        UserCredits uc = new UserCredits();
        uc.setUserId(user.getId());
        uc.setBalance(5);
        creditsRepository.saveAndFlush(uc);

        spotService.create(new SpotRequest(
            "Second Restaurant", "Restaurant", "222 Food St", 13.755, 100.505, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());
        spotService.create(new SpotRequest(
            "Third Restaurant", "Restaurant", "333 Food St", 13.765, 100.515, List.of("food"), List.of(), null, SpotStatus.ACTIVE
        ), true, user.getId());

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Restaurant"),
            "EXPERT",
            "2026-06-01",
            3,
            13.75,
            100.5,
            10.0,
            "CREDITS",
            true,
            null
        );

        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);

        assertThat(response.status()).isEqualTo(GenerationStatus.COMPLETED.name());
        List<String> stopTypes = getGeneratedStopTypes(response.itineraryId());
        assertThat(stopTypes).hasSize(3);
        assertThat(stopTypes).allMatch(type -> type.equalsIgnoreCase("Restaurant"));
    }

    @Test
    public void testRegenerateClonedGeneratedItineraryUsesStoredPreferences() {
        UserCredits uc = new UserCredits();
        uc.setUserId(user.getId());
        uc.setBalance(5);
        creditsRepository.saveAndFlush(uc);

        GenerateItineraryRequest request = new GenerateItineraryRequest(
            List.of("Cafe", "Restaurant", "Bar", "Hotel"),
            "EXPERT",
            "2026-06-01",
            4,
            13.75,
            100.5,
            10.0,
            "CREDITS"
        );

        GenerationResponse response = generationService.initiateGeneration(user.getId(), request);
        ItineraryResponse cloned = itineraryService.cloneItinerary(user.getId(), response.itineraryId());

        ItineraryResponse regenerated = generationService.regenerateItinerary(user.getId(), cloned.id());

        assertThat(regenerated.stops()).hasSize(4);
        assertThat(regenerated.source()).isEqualTo(ItinerarySource.GENERATED.name());
    }

    private List<String> getGeneratedStopTypes(Long itineraryId) {
        List<ItineraryStop> stops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        return stops.stream()
                .map(ItineraryStop::getSpotId)
                .map(spotId -> spotRepository.findById(spotId).orElseThrow().getType())
                .toList();
    }
}
