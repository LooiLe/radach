package com.radach.maps.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.ARAnnotationRequest;
import com.radach.maps.dto.ARAnnotationResponse;
import com.radach.maps.dto.SpotExplanation;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.dto.VibeTagDTO;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.ARAnnotation;
import com.radach.maps.model.Review;
import com.radach.maps.model.Review.Status;
import com.radach.maps.model.Spot;
import com.radach.maps.model.SpotVibeTag;
import com.radach.maps.model.User;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.model.ItineraryStop;
import com.radach.maps.repository.ARAnnotationRepository;
import com.radach.maps.repository.ItineraryStopRepository;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.SpotVibeTagRepository;
import com.radach.maps.repository.UserSpotInteractionRepository;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.repository.VibeTagDefinitionRepository;

@Service
public class ARService {
    private static final int NEARBY_LIMIT = 20;
    private static final int ALTERNATIVE_LIMIT = 10;
    private static final int DEFAULT_RADIUS_METERS = 500;
    private static final int MAX_RADIUS_METERS = 5000;

    private final SpotRepository spotRepository;
    private final ReviewRepository reviewRepository;
    private final SpotVibeTagRepository spotVibeTagRepository;
    private final VibeTagDefinitionRepository vibeTagDefinitionRepository;
    private final FriendshipService friendshipService;
    private final GeminiClient geminiClient;
    private final ItineraryStopRepository itineraryStopRepository;
    private final ARAnnotationRepository arAnnotationRepository;
    private final UserRepository userRepository;
    private final UserSpotInteractionRepository interactionRepository;
    private final CreditService creditService;

    public ARService(
            SpotRepository spotRepository,
            ReviewRepository reviewRepository,
            SpotVibeTagRepository spotVibeTagRepository,
            VibeTagDefinitionRepository vibeTagDefinitionRepository,
            FriendshipService friendshipService,
            ObjectProvider<GeminiClient> geminiClientProvider,
            ItineraryStopRepository itineraryStopRepository,
            ARAnnotationRepository arAnnotationRepository,
            UserRepository userRepository,
            UserSpotInteractionRepository interactionRepository,
            CreditService creditService
    ) {
        this.spotRepository = spotRepository;
        this.reviewRepository = reviewRepository;
        this.spotVibeTagRepository = spotVibeTagRepository;
        this.vibeTagDefinitionRepository = vibeTagDefinitionRepository;
        this.friendshipService = friendshipService;
        this.geminiClient = geminiClientProvider.getIfAvailable();
        this.itineraryStopRepository = itineraryStopRepository;
        this.arAnnotationRepository = arAnnotationRepository;
        this.userRepository = userRepository;
        this.interactionRepository = interactionRepository;
        this.creditService = creditService;
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> findNearbySpots(double lat, double lng, Integer radiusMeters, List<Long> excludeIds) {
        return findNearbySpots(lat, lng, radiusMeters, excludeIds, null);
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> findNearbySpots(double lat, double lng, Integer radiusMeters, List<Long> excludeIds, Long userId) {
        int radius = normalizeRadius(radiusMeters);
        Set<Long> excluded = excludeIds == null ? Set.of() : new HashSet<>(excludeIds);

        List<Spot> spots = spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radius / 1000.0).stream()
                .filter(spot -> !excluded.contains(spot.getId()))
                .limit(NEARBY_LIMIT)
                .toList();
        return toSpotResponses(spots, userId);
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> findNearbySpotsByExpert(double lat, double lng, Long expertId, Integer radiusMeters, List<Long> excludeIds) {
        return findNearbySpotsByExpert(lat, lng, expertId, radiusMeters, excludeIds, null);
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> findNearbySpotsByExpert(double lat, double lng, Long expertId, Integer radiusMeters, List<Long> excludeIds, Long userId) {
        int radius = normalizeRadius(radiusMeters);
        Set<Long> excluded = excludeIds == null ? Set.of() : new HashSet<>(excludeIds);

        List<Spot> spots = spotRepository.findSpotsReviewedByExpert(expertId, lat, lng, radius / 1000.0).stream()
                .filter(spot -> !excluded.contains(spot.getId()))
                .limit(NEARBY_LIMIT)
                .toList();
        return toSpotResponses(spots, userId);
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> findAlternatives(Long spotId, double lat, double lng, Integer radiusMeters) {
        Spot source = spotRepository.findById(spotId)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        String sourceType = normalizeType(source.getType());
        int radius = normalizeRadius(radiusMeters);

        return spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radius / 1000.0).stream()
                .filter(spot -> !Objects.equals(spot.getId(), spotId))
                .sorted(Comparator
                        .comparing((Spot spot) -> !normalizeType(spot.getType()).equals(sourceType))
                        .thenComparing(Spot::getRankScore, Comparator.reverseOrder())
                        .thenComparing(Spot::getId, Comparator.reverseOrder()))
                .limit(ALTERNATIVE_LIMIT)
                .map(this::toSpotResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SpotExplanation buildExplanation(Long spotId, Long userId, Long itineraryId) {
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));

        List<Review> reviews = sortedApprovedReviews(spotId);
        List<String> vibeNames = topVibeNames(spotId);
        List<String> highlights = knownForParts(spot, vibeNames);
        Review bestReview = reviews.stream().findFirst().orElse(null);
        Review friendReview = findFriendReview(reviews, userId);
        Double averageRating = reviewRepository.findAverageRatingBySpotId(spotId);

        Spot similarSpot = null;
        List<Review> similarReviews = List.of();
        ItineraryStop targetStop = null;
        if (itineraryId != null) {
            List<ItineraryStop> stops = itineraryStopRepository.findByItineraryIdOrderByStopOrderAsc(itineraryId);
            targetStop = stops.stream()
                    .filter(stop -> Objects.equals(stop.getSpotId(), spotId))
                    .findFirst()
                    .orElse(null);
            if (!stops.isEmpty()) {
                List<Long> itinerarySpotIds = stops.stream()
                        .map(ItineraryStop::getSpotId)
                        .filter(id -> !Objects.equals(id, spotId))
                        .toList();
                if (!itinerarySpotIds.isEmpty()) {
                    List<Spot> itinerarySpots = spotRepository.findAllById(itinerarySpotIds);
                    String targetType = normalizeType(spot.getType());
                    if (!targetType.isEmpty()) {
                        similarSpot = itinerarySpots.stream()
                                .filter(s -> targetType.equals(normalizeType(s.getType())))
                                .findFirst()
                                .orElse(null);
                        if (similarSpot != null) {
                            similarReviews = sortedApprovedReviews(similarSpot.getId());
                        }
                    }
                }
            }
        }

        SpotExplanation base = new SpotExplanation(
                spot.getId(),
                spot.getName(),
                buildWhatIsThis(spot, highlights, averageRating, reviews.size()),
                whoIsThisForForType(spot.getType(), vibeNames, averageRating, reviews.size()),
                buildQuickFact(spot, bestReview, averageRating, reviews.size()),
                buildComparison(spot, similarSpot, reviews, similarReviews),
                friendReview == null ? null : trimSentence(friendReview.getBody(), 140),
                buildHighlights(spot, vibeNames, reviews, averageRating),
                buildVisitTip(spot, targetStop, bestReview),
                false
        );

        if (geminiClient == null) {
            return base;
        }

        return geminiClient.enhanceExplanation(base, spot, vibeNames, reviews, similarSpot, similarReviews).orElse(base);
    }

    private String buildWhatIsThis(Spot spot, List<String> highlights, Double averageRating, int reviewCount) {
        String type = displayType(spot.getType());
        String area = cleanArea(spot.getAddress());
        String ratingPart = ratingPhrase(averageRating, reviewCount);
        String highlightPart = highlights.isEmpty()
                ? typeIdentity(type)
                : "The main signals are " + humanList(highlights.stream().limit(3).toList()) + ".";
        return trimSentence(typeWithArticle(type) + " in " + area + ". " + highlightPart + ratingPart, 260);
    }

    private String whoIsThisForForType(String rawType, List<String> vibeNames, Double averageRating, int reviewCount) {
        String type = normalizeType(rawType);
        String base = switch (type) {
            case "cafe" -> "Coffee lovers, remote workers, and casual visitors.";
            case "restaurant" -> "Foodies, couples, and groups looking for a dining spot.";
            case "bar" -> "Nightlife enthusiasts and social groups looking for drinks.";
            case "hotel" -> "Travelers and tourists looking for a convenient stay.";
            case "market" -> "Shoppers, bargain hunters, and street food lovers.";
            case "viewpoint" -> "Sightseers, photographers, and nature lovers.";
            case "beach" -> "Sunbathers, swimmers, and relaxation seekers.";
            case "trail" -> "Hikers, adventure seekers, and outdoor enthusiasts.";
            default -> "Visitors looking for interesting spots in this area.";
        };
        if (!vibeNames.isEmpty()) {
            return trimSentence(base + " Especially relevant if you like " + humanList(vibeNames.stream().limit(2).toList()) + ".", 220);
        }
        if (averageRating != null && reviewCount > 0 && averageRating >= 4.3) {
            return trimSentence(base + " It also has a strong rating signal from visitors.", 220);
        }
        return base;
    }

    private String buildQuickFact(Spot spot, Review bestReview, Double averageRating, int reviewCount) {
        if (bestReview != null && bestReview.getBody() != null && !bestReview.getBody().isBlank()) {
            return reviewSummary(bestReview);
        }
        if (averageRating != null && reviewCount > 0) {
            return "Visitor signal: " + String.format(Locale.ROOT, "%.1f", averageRating) + "/5 from approved reviews. " + tipForType(spot.getType());
        }
        List<String> tags = cleanedTags(spot);
        if (!tags.isEmpty()) {
            return "Context clue: it is tagged for " + humanList(tags.stream().limit(3).toList()) + ", so use it as a quick-fit signal before detouring.";
        }
        return tipForType(spot.getType());
    }

    private String buildComparison(Spot spot, Spot similarSpot, List<Review> reviews, List<Review> similarReviews) {
        if (similarSpot == null) {
            return null;
        }
        String type = displayType(spot.getType()).toLowerCase(Locale.ROOT);
        String targetSignal = comparisonSignal(spot, reviews);
        String similarSignal = comparisonSignal(similarSpot, similarReviews);
        return trimSentence(
                "Compare before switching: this " + type + " offers " + targetSignal
                        + ", while " + similarSpot.getName() + " offers " + similarSignal + ".",
                180
        );
    }

    private List<String> buildHighlights(Spot spot, List<String> vibeNames, List<Review> reviews, Double averageRating) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        vibeNames.stream()
                .filter(value -> value != null && !value.isBlank())
                .limit(3)
                .map(value -> "Vibe: " + value)
                .forEach(result::add);
        cleanedTags(spot).stream()
                .limit(3)
                .map(value -> "Tagged: " + value)
                .forEach(result::add);
        if (averageRating != null && !reviews.isEmpty()) {
            result.add(String.format(Locale.ROOT, "Rated %.1f/5 by approved reviews", averageRating));
        }
        reviews.stream()
                .filter(review -> review.getBody() != null && !review.getBody().isBlank())
                .limit(2)
                .map(review -> (review.getReviewType() == Review.ReviewType.EXPERT ? "Expert note: " : "Visitor note: ")
                        + trimSentence(review.getBody(), 90))
                .forEach(result::add);
        result.add(typeHighlight(spot.getType()));
        return result.stream().filter(value -> value != null && !value.isBlank()).limit(5).toList();
    }

    private String buildVisitTip(Spot spot, ItineraryStop targetStop, Review bestReview) {
        List<String> parts = new ArrayList<>();
        if (targetStop != null) {
            if (targetStop.getStartTime() != null) {
                parts.add("Your itinerary places this around " + targetStop.getStartTime());
            }
            if (targetStop.getDurationMinutes() != null && targetStop.getDurationMinutes() > 0) {
                parts.add("plan about " + targetStop.getDurationMinutes() + " minutes");
            }
            if (targetStop.getNotes() != null && !targetStop.getNotes().isBlank()) {
                parts.add("note: " + trimSentence(targetStop.getNotes(), 90));
            }
        }
        if (bestReview != null && bestReview.getRating() != null && bestReview.getRating() >= 4.5) {
            parts.add("worth a closer look based on the strongest review");
        }
        if (parts.isEmpty()) {
            parts.add(tipForType(spot.getType()));
        }
        return trimSentence(humanList(parts) + ".", 220);
    }

    private String ratingPhrase(Double averageRating, int reviewCount) {
        if (averageRating == null || reviewCount <= 0) {
            return "";
        }
        return " Approved reviews average " + String.format(Locale.ROOT, "%.1f", averageRating) + "/5.";
    }

    private String comparisonSignal(Spot spot, List<Review> reviews) {
        Review best = reviews == null ? null : reviews.stream().findFirst().orElse(null);
        if (best != null && best.getBody() != null && !best.getBody().isBlank()) {
            return "\"" + trimSentence(best.getBody(), 70) + "\"";
        }
        List<String> tags = cleanedTags(spot);
        if (!tags.isEmpty()) {
            return humanList(tags.stream().limit(2).toList());
        }
        return "a similar " + displayType(spot.getType()).toLowerCase(Locale.ROOT) + " stop nearby";
    }

    private String typeIdentity(String type) {
        String normalized = normalizeType(type);
        return switch (normalized) {
            case "cafe" -> "Use it as a coffee, dessert, or short rest candidate.";
            case "restaurant" -> "Use it as a meal stop candidate and compare it with nearby dining options.";
            case "bar" -> "Use it as an evening or social stop candidate.";
            case "hotel" -> "Use it as a lodging landmark and check what is walkable around it.";
            case "market" -> "Use it for local browsing, snacks, and quick atmosphere checks.";
            case "viewpoint" -> "Use it when visibility and timing matter more than amenities.";
            case "beach" -> "Use it for a slower outdoor stop; weather and return route matter.";
            case "trail" -> "Use it only if daylight, footwear, and weather are on your side.";
            default -> "Use nearby context, tags, and reviews to decide whether it deserves a detour.";
        };
    }

    private String typeHighlight(String rawType) {
        String type = normalizeType(rawType);
        return switch (type) {
            case "cafe" -> "Good candidate for a short pause or casual meet-up";
            case "restaurant" -> "Best judged by menu fit, timing, and group appetite";
            case "bar" -> "Check opening hours and current energy before committing";
            case "hotel" -> "Useful as a base point for nearby exploration";
            case "market" -> "Scan for food, local goods, and crowd level";
            case "viewpoint" -> "Best when weather and light are cooperating";
            case "beach" -> "Check shade, water conditions, and route back";
            case "trail" -> "Check terrain, daylight, and supplies first";
            default -> "Useful as a nearby discovery candidate";
        };
    }

    private String typeWithArticle(String type) {
        String clean = type == null || type.isBlank() ? "spot" : type.toLowerCase(Locale.ROOT);
        char first = clean.charAt(0);
        String article = "aeiou".indexOf(first) >= 0 ? "An " : "A ";
        return article + clean;
    }

    private String displayType(String rawType) {
        return rawType == null || rawType.isBlank() ? "Spot" : rawType.trim();
    }

    private List<String> cleanedTags(Spot spot) {
        if (spot.getTags() == null) {
            return List.of();
        }
        String type = normalizeType(spot.getType());
        return spot.getTags().stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(String::trim)
                .filter(tag -> !"thailand".equalsIgnoreCase(tag))
                .filter(tag -> !tag.equalsIgnoreCase(type))
                .distinct()
                .toList();
    }

    private String humanList(List<String> values) {
        List<String> clean = values == null ? List.of() : values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .toList();
        if (clean.isEmpty()) {
            return "";
        }
        if (clean.size() == 1) {
            return clean.get(0);
        }
        if (clean.size() == 2) {
            return clean.get(0) + " and " + clean.get(1);
        }
        return String.join(", ", clean.subList(0, clean.size() - 1)) + ", and " + clean.get(clean.size() - 1);
    }

    private SpotResponse toSpotResponse(Spot spot) {
        Double averageRating = reviewRepository.findAverageRatingBySpotId(spot.getId());
        return new SpotResponse(spot, averageRating == null ? 0.0 : averageRating);
    }

    private List<SpotResponse> toSpotResponses(List<Spot> spots, Long userId) {
        if (spots == null || spots.isEmpty()) {
            return List.of();
        }

        List<Long> spotIds = spots.stream().map(Spot::getId).toList();
        Map<Long, Double> globalRatings = reviewRepository.findAverageRatingsBySpotIds(spotIds).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).doubleValue()
                ));
        Map<Long, Double> expertRatings = reviewRepository.findAverageExpertRatingsBySpotIds(spotIds).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).longValue(),
                        row -> ((Number) row[1]).doubleValue()
                ));

        Set<Long> friendIds = userId == null ? Set.of() : friendshipService.getFirstDegreeConnections(userId);
        Map<Long, Double> friendRatings = friendIds.isEmpty() ? Map.of() :
                reviewRepository.findAverageFriendsRatingsBySpotIds(spotIds, friendIds).stream()
                        .collect(Collectors.toMap(
                                row -> ((Number) row[0]).longValue(),
                                row -> ((Number) row[1]).doubleValue()
                        ));
        Map<Long, Integer> friendLikeCounts = friendIds.isEmpty() ? Map.of() :
                interactionRepository.countFriendLikesBySpotIds(spotIds, friendIds).stream()
                        .collect(Collectors.toMap(
                                row -> ((Number) row[0]).longValue(),
                                row -> ((Number) row[1]).intValue()
                        ));

        Set<Long> likedSpotIds = userId == null ? Set.of() : interactionRepository.findLikedSpotIdsByUserId(userId);
        Set<Long> savedSpotIds = userId == null ? Set.of() : interactionRepository.findSavedSpotIdsByUserId(userId);

        Set<Long> submitterIds = spots.stream()
                .map(Spot::getSubmittedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> submitters = submitterIds.isEmpty() ? Map.of() :
                userRepository.findAllById(submitterIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));

        Map<Long, List<VibeTagDTO>> vibeTagsBySpot = spotIds.stream()
                .collect(Collectors.toMap(Function.identity(), this::vibeTagsForSpot));

        return spots.stream()
                .map(spot -> {
                    Long spotId = spot.getId();
                    User submitter = spot.getSubmittedBy() == null ? null : submitters.get(spot.getSubmittedBy());
                    Double globalRating = globalRatings.getOrDefault(spotId, 0.0);
                    return new SpotResponse(
                            spot,
                            globalRating,
                            globalRating,
                            expertRatings.getOrDefault(spotId, 0.0),
                            friendRatings.getOrDefault(spotId, 0.0),
                            likedSpotIds.contains(spotId),
                            savedSpotIds.contains(spotId),
                            submitter == null ? null : submitter.getId(),
                            submitter == null ? null : submitter.getName(),
                            submitter != null && submitter.isExpert(),
                            vibeTagsBySpot.getOrDefault(spotId, List.of()),
                            friendLikeCounts.getOrDefault(spotId, 0),
                            "global"
                    );
                })
                .toList();
    }

    private List<VibeTagDTO> vibeTagsForSpot(Long spotId) {
        return spotVibeTagRepository.findBySpotId(spotId).stream()
                .map(spotVibe -> vibeTagDefinitionRepository.findById(spotVibe.getVibeTagId())
                        .map(definition -> new VibeTagDTO(
                                definition.getId(),
                                definition.getName(),
                                definition.getEmoji(),
                                definition.getCategory(),
                                spotVibe.getConfidence(),
                                spotVibe.getSource()
                        ))
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    private List<Review> sortedApprovedReviews(Long spotId) {
        return reviewRepository.findBySpotIdAndStatus(spotId, Status.APPROVED).stream()
                .sorted(Comparator
                        .comparing((Review review) -> review.getReviewType() != Review.ReviewType.EXPERT)
                        .thenComparing(Review::getRating, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Review::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .toList();
    }

    private List<String> topVibeNames(Long spotId) {
        List<SpotVibeTag> spotVibes = spotVibeTagRepository.findBySpotId(spotId).stream()
                .sorted(Comparator.comparing(SpotVibeTag::getConfidence, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(3)
                .toList();
        if (spotVibes.isEmpty()) {
            return List.of();
        }

        Map<Long, VibeTagDefinition> definitions = vibeTagDefinitionRepository
                .findAllById(spotVibes.stream().map(SpotVibeTag::getVibeTagId).toList())
                .stream()
                .collect(Collectors.toMap(VibeTagDefinition::getId, Function.identity()));

        return spotVibes.stream()
                .map(vibe -> definitions.get(vibe.getVibeTagId()))
                .filter(Objects::nonNull)
                .map(VibeTagDefinition::getName)
                .filter(name -> name != null && !name.isBlank())
                .toList();
    }

    private List<String> knownForParts(Spot spot, List<String> vibeNames) {
        LinkedHashSet<String> parts = new LinkedHashSet<>();
        vibeNames.stream()
                .filter(value -> value != null && !value.isBlank())
                .forEach(parts::add);
        if (spot.getTags() != null) {
            spot.getTags().stream()
                    .filter(tag -> tag != null && !tag.isBlank())
                    .filter(tag -> !"thailand".equalsIgnoreCase(tag))
                    .filter(tag -> !tag.equalsIgnoreCase(spot.getType()))
                    .limit(3)
                    .forEach(parts::add);
        }
        return new ArrayList<>(parts).stream().limit(4).toList();
    }

    private Review findFriendReview(List<Review> reviews, Long userId) {
        if (userId == null) {
            return null;
        }
        Set<Long> friendIds = friendshipService.getFirstDegreeConnections(userId);
        if (friendIds.isEmpty()) {
            return null;
        }
        return reviews.stream()
                .filter(review -> friendIds.contains(review.getAuthorId()))
                .findFirst()
                .orElse(null);
    }

    private String buildHeadline(Spot spot, List<String> vibeNames) {
        String type = spot.getType() == null || spot.getType().isBlank() ? "Spot" : spot.getType();
        if (!vibeNames.isEmpty()) {
            return type + " - " + String.join(", ", vibeNames.stream().limit(2).toList());
        }
        return type + " in " + cleanArea(spot.getAddress());
    }

    private String fallbackDescription(Spot spot) {
        String type = spot.getType() == null || spot.getType().isBlank()
                ? "spot"
                : spot.getType().toLowerCase(Locale.ROOT);
        return "This " + type + " is listed near " + cleanArea(spot.getAddress()) + ".";
    }

    private String reviewSummary(Review review) {
        String prefix = review.getReviewType() == Review.ReviewType.EXPERT
                ? "Expert reviewers highlight: "
                : "Visitors say: ";
        return prefix + trimSentence(review.getBody(), 180);
    }

    private String tipForType(String rawType) {
        String type = normalizeType(rawType);
        return switch (type) {
            case "cafe" -> "Good for a slower stop. Check opening hours before you head over.";
            case "restaurant" -> "Useful around meal time. If it is busy, nearby alternatives are listed below.";
            case "bar" -> "Best checked later in the day, and confirm hours before making it your only stop.";
            case "hotel" -> "Use this as a landmark or base, then explore the nearby spots around it.";
            case "market" -> "Arrive earlier for more options and a calmer walk-through.";
            case "viewpoint" -> "Clear weather matters here. Sunset and early morning are usually strongest.";
            case "beach" -> "Bring water and check the route back before staying late.";
            case "trail" -> "Wear proper shoes and keep an eye on daylight and weather.";
            default -> "Tap directions if you want the quickest route from your current location.";
        };
    }

    private int normalizeRadius(Integer radiusMeters) {
        if (radiusMeters == null) {
            return DEFAULT_RADIUS_METERS;
        }
        return Math.max(50, Math.min(radiusMeters, MAX_RADIUS_METERS));
    }

    private String normalizeType(String type) {
        return type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
    }

    private String cleanArea(String address) {
        if (address == null || address.isBlank()) {
            return "this area";
        }
        String[] parts = address.split(",");
        for (String part : parts) {
            String clean = part.trim();
            if (!clean.isBlank() && !"Thailand".equalsIgnoreCase(clean)) {
                return clean;
            }
        }
        return "this area";
    }

    private String trimSentence(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String normalized = text.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        int sentenceEnd = normalized.substring(0, maxLength).lastIndexOf('.');
        if (sentenceEnd > 60) {
            return normalized.substring(0, sentenceEnd + 1);
        }
        int wordEnd = normalized.substring(0, maxLength).lastIndexOf(' ');
        return normalized.substring(0, Math.max(1, wordEnd)) + "...";
    }

    // ═══════════════════════════════════════════════════════════════
    //  AR Annotations — Community "Explain Anything" feature
    // ═══════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<ARAnnotationResponse> findNearbyAnnotations(double lat, double lng, Integer radiusMeters) {
        int radius = normalizeRadius(radiusMeters);
        return arAnnotationRepository.findApprovedWithinRadius(lat, lng, radius).stream()
                .map(this::toAnnotationResponse)
                .toList();
    }

    @Transactional
    public ARAnnotationResponse submitAnnotation(Long userId, ARAnnotationRequest req) {
        ARAnnotation annotation = new ARAnnotation();
        annotation.setLatitude(req.latitude());
        annotation.setLongitude(req.longitude());
        annotation.setRadiusMeters(req.radiusMeters() != null ? req.radiusMeters() : 30.0);
        annotation.setBearing(req.bearing());
        Double pitch = req.pitch();
        if (pitch != null && (pitch < 30.0 || pitch > 150.0)) {
            pitch = 90.0;
        }
        annotation.setPitch(pitch);
        annotation.setTitle(req.title());
        annotation.setDescription(req.description());
        annotation.setPhotoUrl(req.photoUrl());
        annotation.setAuthorId(userId);
        annotation.setStatus(ARAnnotation.Status.PENDING);

        ARAnnotation saved = arAnnotationRepository.save(annotation);
        return toAnnotationResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ARAnnotationResponse> getPendingAnnotations() {
        return arAnnotationRepository.findByStatus(ARAnnotation.Status.PENDING).stream()
                .map(this::toAnnotationResponse)
                .toList();
    }

    @Transactional
    public ARAnnotationResponse reviewAnnotation(Long annotationId, String action, Long adminId, String adminNote) {
        ARAnnotation annotation = arAnnotationRepository.findById(annotationId)
                .orElseThrow(() -> new ResourceNotFoundException("Annotation not found"));

        if ("approve".equalsIgnoreCase(action)) {
            if (annotation.getStatus() == ARAnnotation.Status.PENDING) {
                creditService.addCredits(annotation.getAuthorId(), 1);
            }
            annotation.setStatus(ARAnnotation.Status.APPROVED);
        } else if ("reject".equalsIgnoreCase(action)) {
            annotation.setStatus(ARAnnotation.Status.REJECTED);
        } else {
            throw new IllegalArgumentException("Invalid action: " + action + ". Use 'approve' or 'reject'.");
        }

        annotation.setApprovedById(adminId);
        annotation.setApprovedAt(Instant.now());
        if (adminNote != null && !adminNote.isBlank()) {
            annotation.setAdminNote(adminNote);
        }

        return toAnnotationResponse(arAnnotationRepository.save(annotation));
    }

    @Transactional(readOnly = true)
    public List<ARAnnotationResponse> getAnnotationsByStatus(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            return arAnnotationRepository.findAll().stream()
                    .sorted(Comparator.comparing(ARAnnotation::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::toAnnotationResponse)
                    .toList();
        }
        try {
            ARAnnotation.Status s = ARAnnotation.Status.valueOf(status.toUpperCase(Locale.ROOT));
            return arAnnotationRepository.findByStatus(s).stream()
                    .sorted(Comparator.comparing(ARAnnotation::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::toAnnotationResponse)
                    .toList();
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
    }

    @Transactional
    public ARAnnotationResponse updateAnnotation(Long id, ARAnnotationRequest req) {
        ARAnnotation annotation = arAnnotationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Annotation not found"));

        if (req.latitude() != null) annotation.setLatitude(req.latitude());
        if (req.longitude() != null) annotation.setLongitude(req.longitude());
        if (req.radiusMeters() != null) annotation.setRadiusMeters(req.radiusMeters());
        if (req.bearing() != null) annotation.setBearing(req.bearing());
        if (req.pitch() != null) {
            Double pitch = req.pitch();
            if (pitch < 30.0 || pitch > 150.0) {
                pitch = 90.0;
            }
            annotation.setPitch(pitch);
        }
        if (req.title() != null) annotation.setTitle(req.title());
        if (req.description() != null) annotation.setDescription(req.description());
        if (req.photoUrl() != null) {
            annotation.setPhotoUrl(req.photoUrl().isBlank() ? null : req.photoUrl());
        }

        ARAnnotation saved = arAnnotationRepository.save(annotation);
        return toAnnotationResponse(saved);
    }

    @Transactional
    public void deleteAnnotation(Long id) {
        if (!arAnnotationRepository.existsById(id)) {
            throw new ResourceNotFoundException("Annotation not found");
        }
        arAnnotationRepository.deleteById(id);
    }

    private ARAnnotationResponse toAnnotationResponse(ARAnnotation annotation) {
        String authorName = "Unknown";
        boolean authorIsExpert = false;
        if (annotation.getAuthorId() != null) {
            User author = userRepository.findById(annotation.getAuthorId()).orElse(null);
            if (author != null) {
                authorName = author.getName();
                authorIsExpert = author.isExpert();
            }
        }
        return new ARAnnotationResponse(
                annotation.getId(),
                annotation.getLatitude(),
                annotation.getLongitude(),
                annotation.getRadiusMeters(),
                annotation.getBearing(),
                annotation.getPitch(),
                annotation.getTitle(),
                annotation.getDescription(),
                annotation.getPhotoUrl(),
                annotation.getAuthorId(),
                authorName,
                authorIsExpert,
                annotation.getStatus().name(),
                annotation.getCreatedAt(),
                annotation.getApprovedAt()
        );
    }
}
