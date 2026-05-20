package com.radach.maps.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotResponse;
import com.radach.maps.dto.VibeTagDTO;
import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.Spot;
import com.radach.maps.model.SpotStatus;
import com.radach.maps.model.SpotVibeTag;
import com.radach.maps.model.VibeTagDefinition;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.SpotVibeTagRepository;
import com.radach.maps.repository.VibeTagDefinitionRepository;

@Service
public class SpotService {

    private final SpotRepository spotRepository;
    private final ReviewRepository reviewRepository;
    private final FriendshipService friendshipService;
    private final com.radach.maps.repository.SpotEventRepository spotEventRepository;
    private final com.radach.maps.repository.UserSpotInteractionRepository interactionRepository;

    private final com.radach.maps.repository.UserRepository userRepository;
    private final SpotVibeTagRepository spotVibeRepo;
    private final VibeTagDefinitionRepository vibeDefRepo;

    public SpotService(SpotRepository spotRepository, ReviewRepository reviewRepository, FriendshipService friendshipService, com.radach.maps.repository.SpotEventRepository spotEventRepository, com.radach.maps.repository.UserSpotInteractionRepository interactionRepository, com.radach.maps.repository.UserRepository userRepository, SpotVibeTagRepository spotVibeRepo, VibeTagDefinitionRepository vibeDefRepo) {
        this.spotRepository = spotRepository;
        this.reviewRepository = reviewRepository;
        this.friendshipService = friendshipService;
        this.spotEventRepository = spotEventRepository;
        this.interactionRepository = interactionRepository;
        this.userRepository = userRepository;
        this.spotVibeRepo = spotVibeRepo;
        this.vibeDefRepo = vibeDefRepo;
    }

    /** Load vibe tags for a spot and convert to DTOs. */
    private List<VibeTagDTO> loadVibeTags(Long spotId) {
        return spotVibeRepo.findBySpotId(spotId).stream()
                .map(svt -> {
                    VibeTagDefinition def = vibeDefRepo.findById(svt.getVibeTagId()).orElse(null);
                    if (def == null) return null;
                    return new VibeTagDTO(
                            def.getId(),
                            def.getName(),
                            def.getEmoji(),
                            def.getCategory(),
                            svt.getConfidence(),
                            svt.getSource()
                    );
                })
                .filter(dto -> dto != null)
                .toList();
    }

    private List<SpotResponse> withRatingsAndInteractions(List<Spot> spots, Long authenticatedUserId) {
        if (spots.isEmpty()) return List.of();

        List<Long> spotIds = spots.stream().map(Spot::getId).toList();
        Map<Long, Double> ratings = reviewRepository.findAverageRatingsBySpotIds(spotIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Double) row[1]
                ));

        Set<Long> likedSpotIds = authenticatedUserId != null ? interactionRepository.findLikedSpotIdsByUserId(authenticatedUserId) : Set.of();
        Set<Long> savedSpotIds = authenticatedUserId != null ? interactionRepository.findSavedSpotIdsByUserId(authenticatedUserId) : Set.of();

        Set<Long> submitterIds = spots.stream().map(Spot::getSubmittedBy).filter(id -> id != null).collect(Collectors.toSet());
        Map<Long, com.radach.maps.model.User> submitters = submitterIds.isEmpty() ? Map.of() : 
                userRepository.findAllById(submitterIds).stream()
                .collect(Collectors.toMap(com.radach.maps.model.User::getId, java.util.function.Function.identity()));

        // Batch-load vibe tags for all spots to avoid N+1
        Map<Long, List<VibeTagDTO>> vibeTagMap = spotIds.stream()
                .collect(Collectors.toMap(
                        id -> id,
                        id -> loadVibeTags(id)
                ));

        return spots.stream()
                .map(spot -> {
                    com.radach.maps.model.User submitter = spot.getSubmittedBy() != null ? submitters.get(spot.getSubmittedBy()) : null;
                    return new SpotResponse(
                            spot, 
                            ratings.getOrDefault(spot.getId(), 0.0),
                            likedSpotIds.contains(spot.getId()),
                            savedSpotIds.contains(spot.getId()),
                            submitter != null ? submitter.getId() : null,
                            submitter != null ? submitter.getName() : null,
                            submitter != null && submitter.isExpert(),
                            vibeTagMap.getOrDefault(spot.getId(), List.of())
                    );
                })
                .toList();
    }
    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Long authenticatedUserId) {
        boolean geoSearch = lat != null || lng != null || radiusKm != null;
        if (geoSearch && (lat == null || lng == null || radiusKm == null)) {
            throw new IllegalArgumentException("lat, lng, and radiusKm are required for geo search");
        }
        if (radiusKm != null && radiusKm <= 0) {
            throw new IllegalArgumentException("radiusKm must be greater than 0");
        }

        boolean sortPopularity = "popularity".equalsIgnoreCase(sortBy);

        List<Spot> spots;
        if (geoSearch) {
            spots = sortPopularity 
                    ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                    : spotRepository.findWithinRadius(lat, lng, radiusKm);
        } else {
            spots = sortPopularity
                    ? spotRepository.findAllByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE)
                    : spotRepository.findAllByStatus(SpotStatus.ACTIVE);
        }

        return withRatingsAndInteractions(spots, authenticatedUserId);
    }

    public SpotResponse findById(Long id, Long authenticatedUserId) {
        Spot spot = spotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        Double avg = reviewRepository.findAverageRatingBySpotId(spot.getId());
        
        boolean isLiked = false;
        boolean isSaved = false;
        if (authenticatedUserId != null) {
            var interaction = interactionRepository.findByUserIdAndSpotId(authenticatedUserId, spot.getId());
            if (interaction.isPresent()) {
                isLiked = interaction.get().isLiked();
                isSaved = interaction.get().isSaved();
            }
        }
        
        List<VibeTagDTO> vibeTags = loadVibeTags(id);
        com.radach.maps.model.User submitter = spot.getSubmittedBy() != null ? userRepository.findById(spot.getSubmittedBy()).orElse(null) : null;
        return new SpotResponse(
                spot, avg, isLiked, isSaved, 
                submitter != null ? submitter.getId() : null,
                submitter != null ? submitter.getName() : null,
                submitter != null && submitter.isExpert(),
                vibeTags
        );
    }

    @Transactional
    public SpotResponse create(SpotRequest request, boolean isAdmin, Long authenticatedUserId) {
        Spot spot = new Spot();
        spot.setName(request.name().trim());
        spot.setType(request.type().trim());
        spot.setAddress(request.address().trim());
        spot.setLatitude(request.latitude());
        spot.setLongitude(request.longitude());
        spot.setTags(request.tags() == null ? List.of() : request.tags());
        spot.setPhotos(request.photos() == null ? List.of() : request.photos());
        spot.setWebsiteUrl(request.websiteUrl());
        spot.setSubmittedBy(authenticatedUserId);
        if (isAdmin) {
            spot.setStatus(request.status());
        } else {
            spot.setStatus(SpotStatus.PENDING);
        }

        Spot saved = spotRepository.save(spot);
        return findById(saved.getId(), authenticatedUserId);
    }

    @Transactional
    public SpotResponse update(Long id, SpotRequest request) {
        Spot spot = spotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
                
        // Find deleted photos to clean up disk
        List<String> oldPhotos = spot.getPhotos() == null ? List.of() : spot.getPhotos();
        List<String> newPhotos = request.photos() == null ? List.of() : request.photos();
        
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
                
        spot.setName(request.name().trim());
        spot.setType(request.type().trim());
        spot.setAddress(request.address().trim());
        spot.setLatitude(request.latitude());
        spot.setLongitude(request.longitude());
        spot.setTags(request.tags() == null ? List.of() : request.tags());
        spot.setPhotos(newPhotos);
        spot.setWebsiteUrl(request.websiteUrl());
        spot.setStatus(request.status());

        Spot saved = spotRepository.save(spot);
        return findById(saved.getId(), null);
    }

    @Transactional
    public void deleteSpot(Long id) {
        Spot spot = spotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        
        // Delete associated photos from disk
        if (spot.getPhotos() != null) {
            java.nio.file.Path uploadDir = java.nio.file.Paths.get("uploads");
            for (String photoUrl : spot.getPhotos()) {
                if (photoUrl != null && photoUrl.startsWith("/uploads/")) {
                    String filename = photoUrl.substring("/uploads/".length());
                    if (!filename.contains("..") && !filename.contains("/") && !filename.contains("\\")) {
                        try {
                            java.nio.file.Files.deleteIfExists(uploadDir.resolve(filename));
                        } catch (java.io.IOException e) {
                            // Log and ignore to not fail the transaction just because a file is missing/locked
                            System.err.println("Failed to delete photo: " + photoUrl);
                        }
                    }
                }
            }
        }
        
        reviewRepository.deleteBySpotId(spot.getId());
        spotEventRepository.deleteBySpotId(spot.getId());
        spotRepository.delete(spot);
    }

    public List<SpotResponse> getPendingSpots() {
        List<Spot> spots = spotRepository.findByStatusOrderByCreatedAtAsc(SpotStatus.PENDING);
        return withRatingsAndInteractions(spots, null);
    }

    @Transactional
    public SpotResponse updateStatus(Long id, SpotStatus status) {
        Spot spot = spotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        spot.setStatus(status);
        Spot saved = spotRepository.save(spot);
        return findById(saved.getId(), null);
    }

    public List<SpotResponse> getTrending(Long authenticatedUserId, Double lat, Double lng, Double radiusKm) {
        boolean geoSearch = lat != null && lng != null && radiusKm != null;

        if (authenticatedUserId == null) {
            // Unauthenticated ranking
            List<Spot> spots = geoSearch
                    ? spotRepository.findWithinRadius(lat, lng, radiusKm)
                    : spotRepository.findTop20ByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE);
            
            if (geoSearch) {
                // Geo search returns all spots in radius ordered by distance, need to sort by global score and take top 20
                spots = spots.stream()
                        .sorted((s1, s2) -> Integer.compare(s2.getRankScore(), s1.getRankScore()))
                        .limit(20)
                        .toList();
            }
            return sortTrending(withRatingsAndInteractions(spots, null));
        }

        // Personalized trending based on friends
        Set<Long> firstDegree = friendshipService.getFirstDegreeConnections(authenticatedUserId);
        Set<Long> secondDegree = friendshipService.getSecondDegreeConnections(authenticatedUserId);

        // spotId -> score
        Map<Long, Integer> dynamicScores = new java.util.HashMap<>();

        // Helper to get connection multiplier
        java.util.function.Function<Long, Integer> getMultiplier = (authorId) -> {
            if (firstDegree.contains(authorId) || authorId.equals(authenticatedUserId)) return 5;
            if (secondDegree.contains(authorId)) return 4;
            return 1;
        };

        // 1. Add Review Scores — weighted by actual rating (1–5).
        //    Formula: sumOfRatings × 2 × friendMultiplier
        //    e.g. a 5-star review from a 1st-degree friend = 5 × 2 × 5 = 50
        //         a 1-star review from a stranger         = 1 × 2 × 1 = 2
        List<Object[]> ratingData = reviewRepository.sumApprovedRatingsGroupedBySpotAndAuthor();
        for (Object[] row : ratingData) {
            Long spotId = (Long) row[0];
            Long authorId = (Long) row[1];
            double ratingSum = ((Number) row[2]).doubleValue();
            int scoreAddition = (int) (ratingSum * 2 * getMultiplier.apply(authorId));
            dynamicScores.merge(spotId, scoreAddition, Integer::sum);
        }

        // 2. Add Like and Save Scores (Base Like = 5, Base Save = 10)
        List<Object[]> interactions = interactionRepository.findAllActiveInteractions();
        for (Object[] row : interactions) {
            Long spotId = (Long) row[0];
            Long authorId = (Long) row[1];
            boolean isLiked = (Boolean) row[2];
            boolean isSaved = (Boolean) row[3];
            
            int multiplier = getMultiplier.apply(authorId);
            int scoreAddition = 0;
            if (isLiked) scoreAddition += 5 * multiplier;
            if (isSaved) scoreAddition += 10 * multiplier;
            
            dynamicScores.merge(spotId, scoreAddition, Integer::sum);
        }

        List<Spot> allSpots = geoSearch
                ? spotRepository.findWithinRadius(lat, lng, radiusKm)
                : spotRepository.findAllByStatus(SpotStatus.ACTIVE);

        List<Spot> sortedSpots = allSpots.stream()
                .sorted((s1, s2) -> {
                    int score1 = dynamicScores.getOrDefault(s1.getId(), 0);
                    int score2 = dynamicScores.getOrDefault(s2.getId(), 0);
                    if (score1 != score2) {
                        return Integer.compare(score2, score1);
                    }
                    return Integer.compare(s2.getRankScore(), s1.getRankScore()); // fallback to global rank score
                })
                .limit(20)
                .toList();

        return sortTrending(withRatingsAndInteractions(sortedSpots, authenticatedUserId));
    }

    private List<SpotResponse> sortTrending(List<SpotResponse> responses) {
        return responses.stream()
                .sorted((a, b) -> {
                    // Active spots first, then PENDING, then INACTIVE at the bottom
                    int cmp = Integer.compare(statusOrder(a.status()), statusOrder(b.status()));
                    if (cmp != 0) return cmp;
                    // Within same status group, sort by rating descending
                    return Double.compare(
                            b.averageRating() != null ? b.averageRating() : 0.0,
                            a.averageRating() != null ? a.averageRating() : 0.0);
                })
                .toList();
    }

    private int statusOrder(String status) {
        return switch (status) {
            case "ACTIVE" -> 0;
            case "PENDING" -> 1;
            default -> 2;
        };
    }

    public List<SpotResponse> search(String q, Long authenticatedUserId) {
        if (q == null || q.isBlank()) {
            throw new IllegalArgumentException("Search query is required");
        }
        String trimmed = q.trim();
        // Handle vibe: prefix — search by vibe tag name
        if (trimmed.toLowerCase().startsWith("vibe:")) {
            String vibeName = trimmed.substring(5).trim();
            if (vibeName.isEmpty()) {
                throw new IllegalArgumentException("Vibe tag name is required after 'vibe:'");
            }
            return withRatingsAndInteractions(spotRepository.findByVibeTagName(vibeName), authenticatedUserId);
        }
        return withRatingsAndInteractions(spotRepository.searchByNameOrTag(trimmed), authenticatedUserId);
    }
    
    @Transactional
    public SpotResponse toggleLike(Long spotId, Long userId) {
        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        var interaction = interactionRepository.findByUserIdAndSpotId(userId, spotId).orElse(new com.radach.maps.model.UserSpotInteraction());
        if (interaction.getId() == null) {
            interaction.setUserId(userId);
            interaction.setSpotId(spotId);
        }
        interaction.setLiked(!interaction.isLiked());
        interactionRepository.save(interaction);
        return findById(spotId, userId);
    }

    @Transactional
    public SpotResponse toggleSave(Long spotId, Long userId) {
        Spot spot = spotRepository.findById(spotId).orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        var interaction = interactionRepository.findByUserIdAndSpotId(userId, spotId).orElse(new com.radach.maps.model.UserSpotInteraction());
        if (interaction.getId() == null) {
            interaction.setUserId(userId);
            interaction.setSpotId(spotId);
        }
        interaction.setSaved(!interaction.isSaved());
        interactionRepository.save(interaction);
        return findById(spotId, userId);
    }

    public List<SpotResponse> getSavedSpots(Long userId) {
        Set<Long> savedIds = interactionRepository.findSavedSpotIdsByUserId(userId);
        if (savedIds.isEmpty()) return List.of();
        
        List<Spot> spots = spotRepository.findAllById(savedIds);
        return withRatingsAndInteractions(spots, userId);
    }
}
