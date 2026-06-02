package com.radach.maps.service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.radach.maps.dto.GenerateItineraryRequest;
import com.radach.maps.dto.GenerationResponse;
import com.radach.maps.model.*;
import com.radach.maps.repository.*;
import com.stripe.model.checkout.Session;

@Service
public class ItineraryGenerationService {

    private static final Logger log = LoggerFactory.getLogger(ItineraryGenerationService.class);

    /**
     * Default durations per spot type (in minutes).
     * These are used when generating itineraries to assign time slots.
     * To change these, modify the values in this map.
     */
    private static final Map<String, Integer> DEFAULT_DURATIONS = Map.ofEntries(
            Map.entry("restaurant", 60),
            Map.entry("food hall", 60),
            Map.entry("dine & play", 90),
            Map.entry("activity", 90),
            Map.entry("activities", 90),
            Map.entry("nature", 120),
            Map.entry("park", 120),
            Map.entry("culture", 60),
            Map.entry("museum", 60),
            Map.entry("nightlife", 90),
            Map.entry("bar", 90),
            Map.entry("shopping", 45),
            Map.entry("market", 60),
            Map.entry("cafe", 45),
            Map.entry("hotel", 30),
            Map.entry("beach", 120),
            Map.entry("viewpoint", 45),
            Map.entry("venue", 90),
            Map.entry("trail", 120),
            Map.entry("sport", 90),
            Map.entry("children", 90)
    );
    private static final Set<String> LODGING_CATEGORIES = Set.of("hotel", "hostel", "resort", "lodging", "accommodation");
    private static final Set<String> MEAL_CATEGORIES = Set.of("restaurant", "food hall", "dine & play");
    private static final Set<String> MORNING_CATEGORIES = Set.of("cafe", "coffee", "bakery");
    private static final Set<String> EVENING_CATEGORIES = Set.of("bar", "nightlife", "pub", "club");
    private static final Set<String> DAYTIME_CATEGORIES = Set.of(
            "activity", "activities", "attraction", "attractions", "museum", "culture", "nature",
            "park", "beach", "viewpoint", "market", "shopping", "venue", "trail", "sport", "children");
    private static final List<TimeSlot> DAY_TEMPLATE = List.of(
            new TimeSlot(LocalTime.of(9, 0), SlotKind.MORNING),
            new TimeSlot(LocalTime.of(10, 30), SlotKind.DAYTIME),
            new TimeSlot(LocalTime.of(12, 30), SlotKind.MEAL),
            new TimeSlot(LocalTime.of(14, 30), SlotKind.DAYTIME),
            new TimeSlot(LocalTime.of(16, 30), SlotKind.DAYTIME),
            new TimeSlot(LocalTime.of(18, 30), SlotKind.MEAL),
            new TimeSlot(LocalTime.of(20, 30), SlotKind.EVENING)
    );
    private static final int DEFAULT_DURATION_FALLBACK = 45;
    private static final int TRAVEL_BUFFER_MINUTES = 15;
    private static final LocalTime DEFAULT_START_TIME = LocalTime.of(9, 0);
    private static final LocalTime HOTEL_CHECKIN_TIME = LocalTime.of(21, 30);
    private static final int MAX_STOPS = 10;

    private final ItineraryGenerationRepository generationRepository;
    private final ItineraryRepository itineraryRepository;
    private final ItineraryStopRepository stopRepository;
    private final SpotRepository spotRepository;
    private final FriendshipService friendshipService;
    private final StripeService stripeService;
    private final CreditService creditService;
    private final UserSubscriptionRepository subscriptionRepository;
    private final ItineraryService itineraryService;
    private final ObjectMapper objectMapper;

    public ItineraryGenerationService(ItineraryGenerationRepository generationRepository,
                                       ItineraryRepository itineraryRepository,
                                       ItineraryStopRepository stopRepository,
                                       SpotRepository spotRepository,
                                       FriendshipService friendshipService,
                                       StripeService stripeService,
                                       CreditService creditService,
                                       UserSubscriptionRepository subscriptionRepository,
                                       ItineraryService itineraryService,
                                       ObjectMapper objectMapper) {
        this.generationRepository = generationRepository;
        this.itineraryRepository = itineraryRepository;
        this.stopRepository = stopRepository;
        this.spotRepository = spotRepository;
        this.friendshipService = friendshipService;
        this.stripeService = stripeService;
        this.creditService = creditService;
        this.subscriptionRepository = subscriptionRepository;
        this.itineraryService = itineraryService;
        this.objectMapper = objectMapper;
    }

    /**
     * Initiate a generation request. Depending on payment method:
     * - ONE_TIME: create Stripe Checkout Session, return URL
     * - CREDITS: deduct credit, generate immediately
     * - SUBSCRIPTION: check sub is active & within limit, generate immediately
     */
    @Transactional
    public GenerationResponse initiateGeneration(Long userId, GenerateItineraryRequest request) {
        String paymentMethod = request.paymentMethod() != null ? request.paymentMethod() : "ONE_TIME";

        // Serialize preferences to JSON
        String preferencesJson;
        try {
            preferencesJson = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize preferences", e);
        }

        int numberOfStops = request.numberOfStops() != null ? Math.min(request.numberOfStops(), MAX_STOPS) : 5;

        if (paymentMethod.equals("CREDITS")) {
            // Deduct credit and generate immediately
            creditService.deductCredit(userId);

            ItineraryGeneration gen = new ItineraryGeneration();
            gen.setUserId(userId);
            gen.setPreferences(preferencesJson);
            gen.setAmountCents(0);
            gen.setPaymentMethod("CREDITS");
            gen.setStatus(GenerationStatus.GENERATING);
            gen = generationRepository.save(gen);

            generateItinerary(gen, request, userId, numberOfStops);

            return new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                    gen.getPaymentMethod(), gen.getAmountCents(), null, gen.getCreatedAt(), gen.getCompletedAt());

        } else if (paymentMethod.equals("SUBSCRIPTION")) {
            // Verify subscription is active and within limit
            UserSubscription sub = subscriptionRepository.findFirstByUserIdAndStatusOrderByCreatedAtDesc(userId, SubscriptionStatus.ACTIVE)
                    .orElseThrow(() -> new IllegalArgumentException("No active subscription found"));

            if (sub.getTier() != SubscriptionTier.UNLIMITED
                    && sub.getGenerationsUsedThisMonth() >= sub.getGenerationsLimit()) {
                throw new IllegalArgumentException("Monthly generation limit reached. Upgrade to Unlimited or purchase credits.");
            }

            sub.setGenerationsUsedThisMonth(sub.getGenerationsUsedThisMonth() + 1);
            subscriptionRepository.save(sub);

            ItineraryGeneration gen = new ItineraryGeneration();
            gen.setUserId(userId);
            gen.setPreferences(preferencesJson);
            gen.setAmountCents(0);
            gen.setPaymentMethod("SUBSCRIPTION");
            gen.setStatus(GenerationStatus.GENERATING);
            gen = generationRepository.save(gen);

            generateItinerary(gen, request, userId, numberOfStops);

            return new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                    gen.getPaymentMethod(), gen.getAmountCents(), null, gen.getCreatedAt(), gen.getCompletedAt());

        } else {
            // ONE_TIME: create Stripe Checkout Session
            ItineraryGeneration gen = new ItineraryGeneration();
            gen.setUserId(userId);
            gen.setPreferences(preferencesJson);
            gen.setAmountCents(stripeService.getItineraryPriceCents());
            gen.setPaymentMethod("ONE_TIME");
            gen.setStatus(GenerationStatus.PENDING_PAYMENT);
            gen = generationRepository.save(gen);

            if (!stripeService.isConfigured()) {
                // If Stripe isn't configured (dev mode), generate immediately for testing
                log.warn("Stripe not configured — generating itinerary without payment for dev testing");
                gen.setStatus(GenerationStatus.GENERATING);
                gen = generationRepository.save(gen);
                generateItinerary(gen, request, userId, numberOfStops);
                return new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                        gen.getPaymentMethod(), gen.getAmountCents(), null, gen.getCreatedAt(), gen.getCompletedAt());
            }

            try {
                Session session = stripeService.createOneTimeCheckoutSession(userId, gen.getId(), request.cancelUrl());
                gen.setStripeSessionId(session.getId());
                generationRepository.save(gen);

                return new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                        gen.getPaymentMethod(), gen.getAmountCents(), session.getUrl(), gen.getCreatedAt(), gen.getCompletedAt());
            } catch (Exception e) {
                gen.setStatus(GenerationStatus.FAILED);
                generationRepository.save(gen);
                throw new RuntimeException("Failed to create checkout session: " + e.getMessage(), e);
            }
        }
    }

    /**
     * Called after Stripe webhook confirms payment for a ONE_TIME generation.
     */
    @Transactional
    public void handlePaymentSuccess(String stripeSessionId, String paymentIntentId) {
        ItineraryGeneration gen = generationRepository.findByStripeSessionId(stripeSessionId)
                .orElseThrow(() -> new IllegalArgumentException("Generation not found for session: " + stripeSessionId));

        if (gen.getStatus() != GenerationStatus.PENDING_PAYMENT) {
            log.warn("Generation {} already processed (status={}), skipping", gen.getId(), gen.getStatus());
            return;
        }

        gen.setStripePaymentIntentId(paymentIntentId);
        gen.setStatus(GenerationStatus.GENERATING);
        generationRepository.save(gen);

        // Parse the preferences back
        GenerateItineraryRequest request;
        try {
            request = objectMapper.readValue(gen.getPreferences(), GenerateItineraryRequest.class);
        } catch (Exception e) {
            gen.setStatus(GenerationStatus.FAILED);
            generationRepository.save(gen);
            throw new RuntimeException("Failed to parse generation preferences", e);
        }

        int numberOfStops = request.numberOfStops() != null ? Math.min(request.numberOfStops(), MAX_STOPS) : 5;
        generateItinerary(gen, request, gen.getUserId(), numberOfStops);
    }

    /**
     * Core generation algorithm — rule-based, reuses existing trending queries.
     */
    void generateItinerary(ItineraryGeneration gen, GenerateItineraryRequest request,
                                   Long userId, int numberOfStops) {
        try {
            // 1. Fetch candidate spots based on review source
            List<Spot> candidates;
            Instant since = Instant.now().minus(Duration.ofDays(7));
            double lat = request.centerLatitude() != null ? request.centerLatitude() : 0;
            double lng = request.centerLongitude() != null ? request.centerLongitude() : 0;
            double radius = request.radiusKm() != null ? request.radiusKm() : 10;

            String reviewSource = request.reviewSource() != null ? request.reviewSource() : "EXPERT";

            if (reviewSource.equalsIgnoreCase("CONNECTIONS")) {
                Set<Long> firstDegree = friendshipService.getFirstDegreeConnections(userId);
                Set<Long> secondDegree = friendshipService.getSecondDegreeConnections(userId);

                // Avoid empty IN clause — add sentinel value
                if (firstDegree.isEmpty()) firstDegree = Set.of(-1L);
                if (secondDegree.isEmpty()) secondDegree = Set.of(-1L);

                candidates = spotRepository.findPersonalizedTrendingWithinRadius(
                        lat, lng, radius, firstDegree, secondDegree, since);
            } else {
                candidates = spotRepository.findExpertTrendingWithinRadius(lat, lng, radius, since);
            }

            // 2. Filter by preferred categories
            List<String> preferredCategories = request.preferredCategories();
            if (preferredCategories != null && !preferredCategories.isEmpty()) {
                Set<String> lowerCategories = preferredCategories.stream()
                        .map(String::toLowerCase)
                        .collect(Collectors.toSet());
                candidates = candidates.stream()
                        .filter(s -> s.getType() != null && lowerCategories.contains(s.getType().toLowerCase()))
                        .collect(Collectors.toList());
            }

            if (candidates.isEmpty()) {
                gen.setStatus(GenerationStatus.FAILED);
                generationRepository.save(gen);
                log.warn("No spots found matching criteria for generation {}", gen.getId());
                return;
            }

            // 3. Select and order stops with category-aware time slots.
            List<ScheduledSpot> scheduled = scheduleByCategoryRules(candidates, lat, lng, numberOfStops);

            // 5. Create the itinerary
            Itinerary itinerary = new Itinerary();
            itinerary.setUserId(userId);
            itinerary.setTitle("Generated Itinerary — " +
                    (request.date() != null ? request.date() : LocalDate.now().toString()));
            itinerary.setDescription("Auto-generated based on " +
                    (reviewSource.equalsIgnoreCase("CONNECTIONS") ? "friends' reviews" : "expert reviews"));
            if (request.date() != null && !request.date().isBlank()) {
                itinerary.setDate(LocalDate.parse(request.date()));
            } else {
                itinerary.setDate(LocalDate.now());
            }
            itinerary.setStatus(ItineraryStatus.DRAFT);
            itinerary.setSource(ItinerarySource.GENERATED);
            itinerary.setGenerationPreferences(gen.getPreferences());
            itinerary = itineraryRepository.save(itinerary);

            // 6. Assign rule-based time slots and create stops
            List<ItineraryStop> stops = new ArrayList<>();

            for (int i = 0; i < scheduled.size(); i++) {
                ScheduledSpot scheduledSpot = scheduled.get(i);
                Spot spot = scheduledSpot.spot();
                int duration = getDefaultDuration(spot.getType());
                LocalTime startTime = scheduledSpot.startTime();

                ItineraryStop stop = new ItineraryStop();
                stop.setItineraryId(itinerary.getId());
                stop.setSpotId(spot.getId());
                stop.setStopOrder(i + 1);
                stop.setStartTime(startTime);
                stop.setEndTime(startTime.plusMinutes(duration));
                stop.setDurationMinutes(duration);
                stops.add(stop);
            }

            stopRepository.saveAll(stops);

            // 7. Mark generation as completed
            gen.setItineraryId(itinerary.getId());
            gen.setStatus(GenerationStatus.COMPLETED);
            gen.setCompletedAt(Instant.now());
            generationRepository.save(gen);

            log.info("Generated itinerary {} with {} stops for user {}", itinerary.getId(), stops.size(), userId);

        } catch (Exception e) {
            log.error("Failed to generate itinerary for generation {}", gen.getId(), e);
            gen.setStatus(GenerationStatus.FAILED);
            generationRepository.save(gen);
        }
    }

    private List<ScheduledSpot> scheduleByCategoryRules(List<Spot> candidates, double startLat, double startLng, int numberOfStops) {
        List<ScheduledSpot> scheduled = new ArrayList<>();
        Set<Long> usedSpotIds = new HashSet<>();
        Map<Long, Integer> rankIndex = new HashMap<>();
        for (int i = 0; i < candidates.size(); i++) {
            rankIndex.put(candidates.get(i).getId(), i);
        }

        Spot finalHotel = chooseBestCandidate(candidates, usedSpotIds, rankIndex, startLat, startLng,
                spot -> isLodging(spot.getType()));
        boolean reserveHotelStop = finalHotel != null && numberOfStops > 1;
        int nonHotelStopLimit = reserveHotelStop ? numberOfStops - 1 : numberOfStops;

        double currentLat = startLat;
        double currentLng = startLng;
        LocalTime nextFlexibleStart = DEFAULT_START_TIME;

        for (TimeSlot slot : DAY_TEMPLATE) {
            if (scheduled.size() >= nonHotelStopLimit) break;
            Spot spot = chooseForSlot(candidates, usedSpotIds, rankIndex, currentLat, currentLng, slot.kind());
            if (spot == null) continue;

            LocalTime startTime = slot.startTime().isAfter(nextFlexibleStart) ? slot.startTime() : nextFlexibleStart;
            scheduled.add(new ScheduledSpot(spot, startTime));
            usedSpotIds.add(spot.getId());
            currentLat = spot.getLatitude();
            currentLng = spot.getLongitude();
            nextFlexibleStart = startTime.plusMinutes(getDefaultDuration(spot.getType()) + TRAVEL_BUFFER_MINUTES);
        }

        while (scheduled.size() < nonHotelStopLimit) {
            Spot spot = chooseBestCandidate(candidates, usedSpotIds, rankIndex, currentLat, currentLng,
                    candidate -> !isLodging(candidate.getType()));
            if (spot == null) break;

            LocalTime startTime = nextFlexibleStart;
            scheduled.add(new ScheduledSpot(spot, startTime));
            usedSpotIds.add(spot.getId());
            currentLat = spot.getLatitude();
            currentLng = spot.getLongitude();
            nextFlexibleStart = startTime.plusMinutes(getDefaultDuration(spot.getType()) + TRAVEL_BUFFER_MINUTES);
        }

        if (reserveHotelStop) {
            LocalTime hotelTime = nextFlexibleStart.isAfter(HOTEL_CHECKIN_TIME) ? nextFlexibleStart : HOTEL_CHECKIN_TIME;
            scheduled.add(new ScheduledSpot(finalHotel, hotelTime));
        } else if (scheduled.size() < numberOfStops && finalHotel != null) {
            scheduled.add(new ScheduledSpot(finalHotel, HOTEL_CHECKIN_TIME));
        }

        return scheduled;
    }

    private Spot chooseForSlot(List<Spot> candidates, Set<Long> usedSpotIds, Map<Long, Integer> rankIndex,
                               double currentLat, double currentLng, SlotKind slotKind) {
        Spot spot = chooseBestCandidate(candidates, usedSpotIds, rankIndex, currentLat, currentLng,
                candidate -> matchesSlot(candidate.getType(), slotKind));
        if (spot != null) return spot;

        if (slotKind == SlotKind.DAYTIME) {
            return chooseBestCandidate(candidates, usedSpotIds, rankIndex, currentLat, currentLng,
                    candidate -> isFlexibleDaytime(candidate.getType()));
        }
        return null;
    }

    private Spot chooseBestCandidate(List<Spot> candidates, Set<Long> usedSpotIds, Map<Long, Integer> rankIndex,
                                     double currentLat, double currentLng, java.util.function.Predicate<Spot> predicate) {
        return candidates.stream()
                .filter(spot -> spot.getId() != null && !usedSpotIds.contains(spot.getId()))
                .filter(predicate)
                .min(Comparator.comparingDouble(spot ->
                        haversineDistance(currentLat, currentLng, spot.getLatitude(), spot.getLongitude())
                                + rankIndex.getOrDefault(spot.getId(), 0) * 0.15))
                .orElse(null);
    }

    private boolean matchesSlot(String spotType, SlotKind slotKind) {
        return switch (slotKind) {
            case MORNING -> isMorning(spotType);
            case MEAL -> isMeal(spotType);
            case DAYTIME -> isDaytime(spotType);
            case EVENING -> isEvening(spotType);
        };
    }

    private boolean isLodging(String spotType) {
        return LODGING_CATEGORIES.contains(normalizeCategory(spotType));
    }

    private boolean isMeal(String spotType) {
        return MEAL_CATEGORIES.contains(normalizeCategory(spotType));
    }

    private boolean isMorning(String spotType) {
        String normalized = normalizeCategory(spotType);
        return MORNING_CATEGORIES.contains(normalized) || normalized.contains("cafe");
    }

    private boolean isEvening(String spotType) {
        return EVENING_CATEGORIES.contains(normalizeCategory(spotType));
    }

    private boolean isDaytime(String spotType) {
        String normalized = normalizeCategory(spotType);
        return DAYTIME_CATEGORIES.contains(normalized) || normalized.equals("other") || normalized.equals("others");
    }

    private boolean isFlexibleDaytime(String spotType) {
        return isDaytime(spotType)
                && !isMeal(spotType)
                && !isMorning(spotType)
                && !isEvening(spotType)
                && !isLodging(spotType);
    }

    /**
     * Greedy nearest-neighbor route optimization.
     * Starts from the center point and picks the closest unvisited spot each step.
     */
    private List<Spot> optimizeRouteOrder(List<Spot> spots, double startLat, double startLng) {
        List<Spot> ordered = new ArrayList<>();
        List<Spot> remaining = new ArrayList<>(spots);
        double currentLat = startLat;
        double currentLng = startLng;

        while (!remaining.isEmpty()) {
            Spot nearest = null;
            double minDist = Double.MAX_VALUE;

            for (Spot s : remaining) {
                double dist = haversineDistance(currentLat, currentLng, s.getLatitude(), s.getLongitude());
                if (dist < minDist) {
                    minDist = dist;
                    nearest = s;
                }
            }

            if (nearest != null) {
                ordered.add(nearest);
                currentLat = nearest.getLatitude();
                currentLng = nearest.getLongitude();
                remaining.remove(nearest);
            }
        }

        return ordered;
    }

    /**
     * Haversine distance in kilometers.
     */
    private double haversineDistance(double lat1, double lng1, double lat2, double lng2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    /**
     * Get the default duration (in minutes) for a spot type.
     * To change these defaults, modify the DEFAULT_DURATIONS map at the top of this class.
     */
    private int getDefaultDuration(String spotType) {
        if (spotType == null) return DEFAULT_DURATION_FALLBACK;
        return DEFAULT_DURATIONS.getOrDefault(normalizeCategory(spotType), DEFAULT_DURATION_FALLBACK);
    }

    private String normalizeCategory(String category) {
        if (category == null) return "";
        String normalized = Normalizer.normalize(category, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .toLowerCase(Locale.ROOT);
        if (normalized.contains("caf")) return "cafe";
        return normalized;
    }

    private enum SlotKind {
        MORNING,
        MEAL,
        DAYTIME,
        EVENING
    }

    private record TimeSlot(LocalTime startTime, SlotKind kind) {}
    private record ScheduledSpot(Spot spot, LocalTime startTime) {}

    // --- Read-only endpoints ---

    public GenerationResponse getGenerationStatus(Long userId, Long generationId) {
        ItineraryGeneration gen = generationRepository.findById(generationId)
                .orElseThrow(() -> new IllegalArgumentException("Generation not found"));
        if (!gen.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized");
        }
        return new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                gen.getPaymentMethod(), gen.getAmountCents(), null, gen.getCreatedAt(), gen.getCompletedAt());
    }

    public List<GenerationResponse> getMyGenerations(Long userId) {
        return generationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(gen -> new GenerationResponse(gen.getId(), gen.getItineraryId(), gen.getStatus().name(),
                        gen.getPaymentMethod(), gen.getAmountCents(), null, gen.getCreatedAt(), gen.getCompletedAt()))
                .toList();
    }
}
