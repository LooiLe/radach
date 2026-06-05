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
import com.radach.maps.dto.ItineraryResponse;
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
            double lat = request.centerLatitude() != null ? request.centerLatitude() : 0;
            double lng = request.centerLongitude() != null ? request.centerLongitude() : 0;
            String reviewSource = request.reviewSource() != null ? request.reviewSource() : "EXPERT";
            
            int totalDays = request.resolvedNumberOfDays();
            List<Spot> candidates = findGenerationCandidates(userId, request, numberOfStops);

            if (candidates.isEmpty()) {
                gen.setStatus(GenerationStatus.FAILED);
                generationRepository.save(gen);
                log.warn("No spots found matching criteria for generation {}", gen.getId());
                return;
            }

            // Create the itinerary
            Itinerary itinerary = new Itinerary();
            itinerary.setUserId(userId);
            itinerary.setTitle("Generated Itinerary — " +
                    (request.date() != null ? request.date() : LocalDate.now().toString()));
            itinerary.setDescription("Auto-generated based on " +
                    (reviewSource.equalsIgnoreCase("CONNECTIONS") ? "friends' reviews" : "expert reviews"));
            
            LocalDate startDate;
            if (request.date() != null && !request.date().isBlank()) {
                startDate = LocalDate.parse(request.date());
            } else {
                startDate = LocalDate.now();
            }
            itinerary.setDate(startDate);
            if (totalDays > 1) {
                itinerary.setEndDate(startDate.plusDays(totalDays - 1));
            } else {
                itinerary.setEndDate(startDate);
            }
            itinerary.setStatus(ItineraryStatus.DRAFT);
            itinerary.setSource(ItinerarySource.GENERATED);
            itinerary.setGenerationPreferences(gen.getPreferences());
            itinerary = itineraryRepository.save(itinerary);

            List<ItineraryStop> stops = new ArrayList<>();
            List<Spot> remainingCandidates = new ArrayList<>(candidates);
            int globalStopOrder = 1;

            for (int day = 1; day <= totalDays; day++) {
                if (remainingCandidates.size() < numberOfStops) {
                    remainingCandidates.addAll(candidates);
                }
                
                List<ScheduledSpot> scheduled = scheduleByCategoryRules(remainingCandidates, lat, lng, numberOfStops);
                
                // Remove scheduled spots from remaining candidates to avoid duplicates across days
                for (ScheduledSpot ss : scheduled) {
                    remainingCandidates.remove(ss.spot());
                }

                for (int i = 0; i < scheduled.size(); i++) {
                    ScheduledSpot scheduledSpot = scheduled.get(i);
                    Spot spot = scheduledSpot.spot();
                    int duration = getDefaultDuration(spot.getType());
                    LocalTime startTime = scheduledSpot.startTime();

                    ItineraryStop stop = new ItineraryStop();
                    stop.setItineraryId(itinerary.getId());
                    stop.setSpotId(spot.getId());
                    stop.setStopOrder(globalStopOrder++);
                    stop.setStartTime(startTime);
                    stop.setEndTime(startTime.plusMinutes(duration));
                    stop.setDurationMinutes(duration);
                    stop.setDayNumber(day);
                    stops.add(stop);
                }
            }

            stopRepository.saveAll(stops);

            // Mark generation as completed
            gen.setItineraryId(itinerary.getId());
            gen.setStatus(GenerationStatus.COMPLETED);
            gen.setCompletedAt(Instant.now());
            generationRepository.save(gen);

            log.info("Generated itinerary {} with {} stops over {} days for user {}", itinerary.getId(), stops.size(), totalDays, userId);

        } catch (Exception e) {
            log.error("Failed to generate itinerary for generation {}", gen.getId(), e);
            gen.setStatus(GenerationStatus.FAILED);
            generationRepository.save(gen);
        }
    }

    private List<Spot> findGenerationCandidates(Long userId, GenerateItineraryRequest request, int numberOfStops) {
        Instant since = Instant.now().minus(Duration.ofDays(7));
        double lat = request.centerLatitude() != null ? request.centerLatitude() : 0;
        double lng = request.centerLongitude() != null ? request.centerLongitude() : 0;
        double radius = request.radiusKm() != null ? request.radiusKm() : 10;
        String reviewSource = request.reviewSource() != null ? request.reviewSource() : "EXPERT";

        List<Spot> candidates;
        if (reviewSource.equalsIgnoreCase("CONNECTIONS")) {
            Set<Long> firstDegree = friendshipService.getFirstDegreeConnections(userId);
            Set<Long> secondDegree = friendshipService.getSecondDegreeConnections(userId);
            if (firstDegree.isEmpty()) firstDegree = Set.of(-1L);
            if (secondDegree.isEmpty()) secondDegree = Set.of(-1L);
            candidates = spotRepository.findPersonalizedTrendingWithinRadius(lat, lng, radius, firstDegree, secondDegree, since);

            if (candidates.isEmpty()) {
                log.info("No connection-based itinerary candidates found; falling back to expert candidates");
                candidates = spotRepository.findExpertTrendingWithinRadius(lat, lng, radius, since);
            }
        } else {
            candidates = spotRepository.findExpertTrendingWithinRadius(lat, lng, radius, since);
        }

        if (candidates.isEmpty()) {
            candidates = spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radius);
        }

        candidates = dedupeCandidates(candidates);
        candidates = applyCategoryPreferences(candidates, request.preferredCategories(), request.strictCategoryMode());
        return candidates;
    }

    private List<Spot> applyCategoryPreferences(List<Spot> candidates, List<String> preferredCategories, boolean strictCategories) {
        if (preferredCategories == null || preferredCategories.isEmpty()) {
            return candidates;
        }

        Set<String> preferred = preferredCategories.stream()
                .map(this::normalizeCategory)
                .filter(category -> !category.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (preferred.isEmpty()) {
            return candidates;
        }

        if (strictCategories) {
            return candidates.stream()
                    .filter(spot -> preferred.contains(normalizeCategory(spot.getType())))
                    .collect(Collectors.toList());
        }

        return candidates.stream()
                .sorted(Comparator.comparing(spot -> preferred.contains(normalizeCategory(spot.getType())) ? 0 : 1))
                .collect(Collectors.toList());
    }

    private List<Spot> dedupeCandidates(List<Spot> candidates) {
        Set<String> seen = new HashSet<>();
        List<Spot> deduped = new ArrayList<>();

        for (Spot spot : candidates) {
            String key = normalizeCandidateKey(spot);
            if (seen.add(key)) {
                deduped.add(spot);
            }
        }

        return deduped;
    }

    private String normalizeCandidateKey(Spot spot) {
        String name = spot.getName() == null ? "" : normalizeText(spot.getName());
        String address = spot.getAddress() == null ? "" : normalizeText(spot.getAddress());
        return name + "|" + address;
    }

    private String normalizeText(String text) {
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private List<ScheduledSpot> scheduleByCategoryRules(List<Spot> candidates, double startLat, double startLng, int numberOfStops) {
        List<ScheduledSpot> scheduled = new ArrayList<>();
        Set<Long> usedSpotIds = new HashSet<>();
        Map<String, Integer> categoryCounts = new HashMap<>();
        Map<Long, Integer> rankIndex = new HashMap<>();
        for (int i = 0; i < candidates.size(); i++) {
            rankIndex.put(candidates.get(i).getId(), i);
        }

        Spot finalHotel = chooseBestCandidate(candidates, usedSpotIds, rankIndex, categoryCounts, startLat, startLng, startLat, startLng,
                spot -> isLodging(spot.getType()));
        boolean reserveHotelStop = finalHotel != null && numberOfStops > 1;
        int nonHotelStopLimit = reserveHotelStop ? numberOfStops - 1 : numberOfStops;

        double currentLat = startLat;
        double currentLng = startLng;
        LocalTime nextFlexibleStart = DEFAULT_START_TIME;
        boolean isFirst = true;

        for (TimeSlot slot : DAY_TEMPLATE) {
            if (scheduled.size() >= nonHotelStopLimit) break;
            Spot spot = chooseForSlot(candidates, usedSpotIds, rankIndex, categoryCounts, startLat, startLng, currentLat, currentLng, slot.kind());
            if (spot == null) continue;

            LocalTime earliestStart = nextFlexibleStart;
            if (!isFirst) {
                int travelTime = estimateTravelTimeMinutes(currentLat, currentLng, spot.getLatitude(), spot.getLongitude());
                earliestStart = nextFlexibleStart.plusMinutes(travelTime);
            }
            LocalTime startTime = slot.startTime().isAfter(earliestStart) ? slot.startTime() : earliestStart;
            scheduled.add(new ScheduledSpot(spot, startTime));
            usedSpotIds.add(spot.getId());
            incrementCategoryCount(categoryCounts, spot);
            currentLat = spot.getLatitude();
            currentLng = spot.getLongitude();
            nextFlexibleStart = startTime.plusMinutes(getDefaultDuration(spot.getType()));
            isFirst = false;
        }

        while (scheduled.size() < nonHotelStopLimit) {
            Spot spot = chooseBestCandidate(candidates, usedSpotIds, rankIndex, categoryCounts, startLat, startLng, currentLat, currentLng,
                    candidate -> !isLodging(candidate.getType()));
            if (spot == null) break;

            LocalTime earliestStart = nextFlexibleStart;
            if (!isFirst) {
                int travelTime = estimateTravelTimeMinutes(currentLat, currentLng, spot.getLatitude(), spot.getLongitude());
                earliestStart = nextFlexibleStart.plusMinutes(travelTime);
            }
            LocalTime startTime = earliestStart;
            scheduled.add(new ScheduledSpot(spot, startTime));
            usedSpotIds.add(spot.getId());
            incrementCategoryCount(categoryCounts, spot);
            currentLat = spot.getLatitude();
            currentLng = spot.getLongitude();
            nextFlexibleStart = startTime.plusMinutes(getDefaultDuration(spot.getType()));
            isFirst = false;
        }

        if (reserveHotelStop) {
            int travelTime = 0;
            if (!isFirst) {
                travelTime = estimateTravelTimeMinutes(currentLat, currentLng, finalHotel.getLatitude(), finalHotel.getLongitude());
            }
            LocalTime hotelStartTime = nextFlexibleStart.plusMinutes(travelTime);
            LocalTime hotelTime = hotelStartTime.isAfter(HOTEL_CHECKIN_TIME) ? hotelStartTime : HOTEL_CHECKIN_TIME;
            scheduled.add(new ScheduledSpot(finalHotel, hotelTime));
        } else if (scheduled.size() < numberOfStops && finalHotel != null) {
            scheduled.add(new ScheduledSpot(finalHotel, HOTEL_CHECKIN_TIME));
        }

        return scheduled;
    }

    private Spot chooseForSlot(List<Spot> candidates, Set<Long> usedSpotIds, Map<Long, Integer> rankIndex,
                               Map<String, Integer> categoryCounts, double startLat, double startLng,
                               double currentLat, double currentLng, SlotKind slotKind) {
        Spot spot = chooseBestCandidate(candidates, usedSpotIds, rankIndex, categoryCounts, startLat, startLng, currentLat, currentLng,
                candidate -> matchesSlot(candidate.getType(), slotKind));
        if (spot != null) return spot;

        if (slotKind == SlotKind.DAYTIME) {
            return chooseBestCandidate(candidates, usedSpotIds, rankIndex, categoryCounts, startLat, startLng, currentLat, currentLng,
                    candidate -> isFlexibleDaytime(candidate.getType()));
        }
        return null;
    }

    private Spot chooseBestCandidate(List<Spot> candidates, Set<Long> usedSpotIds, Map<Long, Integer> rankIndex,
                                     Map<String, Integer> categoryCounts, double startLat, double startLng,
                                     double currentLat, double currentLng, java.util.function.Predicate<Spot> predicate) {
        return candidates.stream()
                .filter(spot -> spot.getId() != null && !usedSpotIds.contains(spot.getId()))
                .filter(predicate)
                .min(Comparator.comparingDouble(spot -> itineraryCandidateScore(
                        spot, rankIndex, categoryCounts, startLat, startLng, currentLat, currentLng)))
                .orElse(null);
    }

    private double itineraryCandidateScore(Spot spot, Map<Long, Integer> rankIndex, Map<String, Integer> categoryCounts,
                                           double startLat, double startLng, double currentLat, double currentLng) {
        double legDistanceKm = haversineDistance(currentLat, currentLng, spot.getLatitude(), spot.getLongitude());
        double centerDistanceKm = haversineDistance(startLat, startLng, spot.getLatitude(), spot.getLongitude());
        int originalRank = rankIndex.getOrDefault(spot.getId(), 0);
        int repeatedCategoryCount = categoryCounts.getOrDefault(normalizeCategory(spot.getType()), 0);

        return legDistanceKm * 0.75
                + centerDistanceKm * 0.15
                + originalRank * 0.20
                + repeatedCategoryCount * 3.0;
    }

    private void incrementCategoryCount(Map<String, Integer> categoryCounts, Spot spot) {
        String category = normalizeCategory(spot.getType());
        categoryCounts.merge(category, 1, Integer::sum);
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

    private int estimateTravelTimeMinutes(double lat1, double lng1, double lat2, double lng2) {
        double dist = haversineDistance(lat1, lng1, lat2, lng2);
        if (dist < 1.0) {
            return (int) Math.max(5, Math.round((dist * 12.0) + 2.0));
        } else {
            return (int) Math.max(7, Math.round((dist * 2.0) + 3.0));
        }
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

    // --- Regenerate / Swap ---

    /**
     * Regenerate an existing generated itinerary by re-running the algorithm
     * with shuffled candidates for variety. Free — no additional payment required.
     */
    @Transactional
    public ItineraryResponse regenerateItinerary(Long userId, Long itineraryId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        if (itinerary.getSource() != ItinerarySource.GENERATED) {
            throw new IllegalArgumentException("Only generated itineraries can be regenerated");
        }

        GenerateItineraryRequest request = loadRegenerationRequest(itinerary);

        // Delete existing stops
        stopRepository.deleteByItineraryId(itineraryId);
        stopRepository.flush();

        // Re-run generation with shuffled candidates for variety
        int numberOfStops = request.numberOfStops() != null ? Math.min(request.numberOfStops(), MAX_STOPS) : 5;
        int totalDays = request.resolvedNumberOfDays();

        double lat = request.centerLatitude() != null ? request.centerLatitude() : 0;
        double lng = request.centerLongitude() != null ? request.centerLongitude() : 0;
        List<Spot> candidates = new ArrayList<>(findGenerationCandidates(userId, request, numberOfStops));

        if (candidates.isEmpty()) {
            throw new IllegalArgumentException("No spots found matching criteria. Try adjusting your preferences.");
        }

        // Shuffle to produce different results
        Collections.shuffle(candidates);

        List<ItineraryStop> newStops = new ArrayList<>();
        List<Spot> remainingCandidates = new ArrayList<>(candidates);
        int globalStopOrder = 1;

        for (int day = 1; day <= totalDays; day++) {
            if (remainingCandidates.size() < numberOfStops) {
                remainingCandidates.addAll(candidates);
            }
            
            List<ScheduledSpot> scheduled = scheduleByCategoryRules(remainingCandidates, lat, lng, numberOfStops);
            
            // Remove scheduled spots from remaining candidates to avoid duplicates across days
            for (ScheduledSpot ss : scheduled) {
                remainingCandidates.remove(ss.spot());
            }

            for (int i = 0; i < scheduled.size(); i++) {
                ScheduledSpot scheduledSpot = scheduled.get(i);
                Spot spot = scheduledSpot.spot();
                int duration = getDefaultDuration(spot.getType());
                LocalTime startTime = scheduledSpot.startTime();

                ItineraryStop stop = new ItineraryStop();
                stop.setItineraryId(itineraryId);
                stop.setSpotId(spot.getId());
                stop.setStopOrder(globalStopOrder++);
                stop.setStartTime(startTime);
                stop.setEndTime(startTime.plusMinutes(duration));
                stop.setDurationMinutes(duration);
                stop.setDayNumber(day);
                newStops.add(stop);
            }
        }
        stopRepository.saveAll(newStops);

        log.info("Regenerated itinerary {} with {} stops for user {}", itineraryId, newStops.size(), userId);
        return itineraryService.toResponse(itinerary, true);
    }

    private GenerateItineraryRequest loadRegenerationRequest(Itinerary itinerary) {
        Optional<ItineraryGeneration> generation = generationRepository.findByItineraryId(itinerary.getId());

        if (generation.isPresent()) {
            return parseGenerationPreferences(generation.get().getPreferences());
        }

        if (itinerary.getGenerationPreferences() != null && !itinerary.getGenerationPreferences().isBlank()) {
            return parseGenerationPreferences(itinerary.getGenerationPreferences());
        }

        return inferGenerationRequestFromCurrentStops(itinerary);
    }

    private GenerateItineraryRequest parseGenerationPreferences(String preferencesJson) {
        try {
            return objectMapper.readValue(preferencesJson, GenerateItineraryRequest.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse original generation preferences", e);
        }
    }

    private GenerateItineraryRequest inferGenerationRequestFromCurrentStops(Itinerary itinerary) {
        List<ItineraryStop> currentStops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itinerary.getId());
        if (currentStops.isEmpty()) {
            throw new IllegalArgumentException("No original generation preferences found for this itinerary");
        }

        List<Long> spotIds = currentStops.stream().map(ItineraryStop::getSpotId).toList();
        List<Spot> spots = spotRepository.findAllById(spotIds);
        if (spots.isEmpty()) {
            throw new IllegalArgumentException("No original generation preferences found for this itinerary");
        }

        List<String> categories = spots.stream()
                .map(Spot::getType)
                .filter(type -> type != null && !type.isBlank())
                .map(this::normalizeCategory)
                .distinct()
                .toList();

        double centerLat = spots.stream().mapToDouble(Spot::getLatitude).average().orElse(0.0);
        double centerLng = spots.stream().mapToDouble(Spot::getLongitude).average().orElse(0.0);
        double radiusKm = Math.max(5.0, estimateRadiusFromCenter(spots, centerLat, centerLng) + 2.0);

        return new GenerateItineraryRequest(
                categories,
                "EXPERT",
                itinerary.getDate() != null ? itinerary.getDate().toString() : null,
                currentStops.size(),
                centerLat,
                centerLng,
                radiusKm,
                "SUBSCRIPTION"
        );
    }

    private double estimateRadiusFromCenter(List<Spot> spots, double centerLat, double centerLng) {
        return spots.stream()
                .mapToDouble(spot -> haversineDistance(centerLat, centerLng, spot.getLatitude(), spot.getLongitude()))
                .max()
                .orElse(5.0);
    }

    /**
     * Swap a single stop in a generated itinerary with the next-best alternative
     * from the same category.
     */
    @Transactional
    public ItineraryResponse swapStop(Long userId, Long itineraryId, Long stopId) {
        Itinerary itinerary = itineraryRepository.findByIdAndUserId(itineraryId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Itinerary not found"));

        if (itinerary.getSource() != ItinerarySource.GENERATED) {
            throw new IllegalArgumentException("Swap is only available for generated itineraries");
        }

        ItineraryStop targetStop = stopRepository.findById(stopId)
                .orElseThrow(() -> new IllegalArgumentException("Stop not found"));

        if (!targetStop.getItineraryId().equals(itineraryId)) {
            throw new IllegalArgumentException("Stop does not belong to this itinerary");
        }

        // Get the spot being replaced
        Spot currentSpot = spotRepository.findById(targetStop.getSpotId())
                .orElseThrow(() -> new IllegalArgumentException("Current spot not found"));

        // Get all spot IDs already in this itinerary (to exclude)
        List<ItineraryStop> allStops = stopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
        Set<Long> excludedSpotIds = allStops.stream().map(ItineraryStop::getSpotId).collect(Collectors.toSet());

        // Find the original generation preferences for radius/location
        ItineraryGeneration gen = generationRepository.findByItineraryId(itineraryId)
                .orElseThrow(() -> new IllegalArgumentException("Original generation record not found"));

        GenerateItineraryRequest request;
        try {
            request = objectMapper.readValue(gen.getPreferences(), GenerateItineraryRequest.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse generation preferences", e);
        }

        List<Spot> candidates = findGenerationCandidates(userId, request, allStops.size() + 3);

        // Filter to same category as the current spot, exclude already-used spots
        String currentType = normalizeCategory(currentSpot.getType());
        List<Spot> sameCategoryCandidates = candidates.stream()
                .filter(s -> s.getId() != null && !excludedSpotIds.contains(s.getId()))
                .filter(s -> normalizeCategory(s.getType()).equals(currentType))
                .collect(Collectors.toList());

        // If no same-category alternatives, try any category
        if (sameCategoryCandidates.isEmpty()) {
            sameCategoryCandidates = candidates.stream()
                    .filter(s -> s.getId() != null && !excludedSpotIds.contains(s.getId()))
                    .collect(Collectors.toList());
        }

        if (sameCategoryCandidates.isEmpty()) {
            throw new IllegalArgumentException("No alternative spots available to swap");
        }

        // Pick the best candidate by proximity to the current spot's position
        Spot replacement = sameCategoryCandidates.stream()
                .min(Comparator.comparingDouble(s ->
                        haversineDistance(currentSpot.getLatitude(), currentSpot.getLongitude(),
                                s.getLatitude(), s.getLongitude())))
                .orElse(sameCategoryCandidates.get(0));

        // Replace the stop's spot
        targetStop.setSpotId(replacement.getId());
        int newDuration = getDefaultDuration(replacement.getType());
        targetStop.setDurationMinutes(newDuration);
        if (targetStop.getStartTime() != null) {
            targetStop.setEndTime(targetStop.getStartTime().plusMinutes(newDuration));
        }
        stopRepository.save(targetStop);

        log.info("Swapped stop {} in itinerary {} from spot {} to spot {}", stopId, itineraryId, currentSpot.getId(), replacement.getId());
        return itineraryService.toResponse(itinerary, true);
    }

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
