package com.radach.maps.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.radach.maps.dto.FriendLikeDTO;

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
        return withRatingsAndInteractions(spots, authenticatedUserId, "global");
    }

    private List<SpotResponse> withRatingsAndInteractions(List<Spot> spots, Long authenticatedUserId, String ratingMode) {
        if (spots.isEmpty()) return List.of();

        List<Long> spotIds = spots.stream().map(Spot::getId).toList();
        String activeMode = (ratingMode != null) ? ratingMode.toLowerCase() : "global";

        // Compute all 3 rating types in batch
        Map<Long, Double> globalRatings = reviewRepository.findAverageRatingsBySpotIds(spotIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Double) row[1]
                ));

        Map<Long, Double> expertRatings = reviewRepository.findAverageExpertRatingsBySpotIds(spotIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Double) row[1]
                ));

        Map<Long, Double> friendsRatings;
        if (authenticatedUserId != null) {
            Set<Long> friendIds = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            if (!friendIds.isEmpty()) {
                friendsRatings = reviewRepository.findAverageFriendsRatingsBySpotIds(spotIds, friendIds)
                        .stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> (Double) row[1]
                        ));
            } else {
                friendsRatings = Map.of();
            }
        } else {
            friendsRatings = Map.of();
        }

        // Select which rating to display based on mode
        Map<Long, Double> displayRatings;
        if ("expert".equals(activeMode)) {
            displayRatings = expertRatings;
        } else if ("friends".equals(activeMode) && authenticatedUserId != null) {
            displayRatings = friendsRatings;
        } else {
            displayRatings = globalRatings;
        }

        Set<Long> likedSpotIds = authenticatedUserId != null ? interactionRepository.findLikedSpotIdsByUserId(authenticatedUserId) : Set.of();
        Set<Long> savedSpotIds = authenticatedUserId != null ? interactionRepository.findSavedSpotIdsByUserId(authenticatedUserId) : Set.of();

        // Compute friend like counts for batch
        Set<Long> friendIds = authenticatedUserId != null ? friendshipService.getFirstDegreeConnections(authenticatedUserId) : Set.of();
        Map<Long, Integer> friendLikeCounts;
        if (!friendIds.isEmpty()) {
            friendLikeCounts = interactionRepository.countFriendLikesBySpotIds(spotIds, friendIds).stream()
                    .collect(Collectors.toMap(
                            row -> (Long) row[0],
                            row -> ((Number) row[1]).intValue()
                    ));
        } else {
            friendLikeCounts = Map.of();
        }

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
                    Long spotId = spot.getId();
                    return new SpotResponse(
                            spot, 
                            displayRatings.getOrDefault(spotId, 0.0),
                            globalRatings.getOrDefault(spotId, 0.0),
                            expertRatings.getOrDefault(spotId, 0.0),
                            friendsRatings.getOrDefault(spotId, 0.0),
                            likedSpotIds.contains(spotId),
                            savedSpotIds.contains(spotId),
                            submitter != null ? submitter.getId() : null,
                            submitter != null ? submitter.getName() : null,
                            submitter != null && submitter.isExpert(),
                            vibeTagMap.getOrDefault(spotId, List.of()),
                            friendLikeCounts.getOrDefault(spotId, 0),
                            activeMode
                    );
                })
                .toList();
    }
    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Long authenticatedUserId) {
        return findSpots(lat, lng, radiusKm, sortBy, authenticatedUserId, "global");
    }

    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Long authenticatedUserId, String ratingMode) {
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

        return withRatingsAndInteractions(spots, authenticatedUserId, ratingMode);
    }

    public SpotResponse findById(Long id, Long authenticatedUserId) {
        return findById(id, authenticatedUserId, "global");
    }

    public SpotResponse findById(Long id, Long authenticatedUserId, String ratingMode) {
        Spot spot = spotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Spot not found"));
        Double globalAvg = reviewRepository.findAverageRatingBySpotId(spot.getId());
        Double expertAvg = 0.0;
        Double friendsAvg = 0.0;
        
        // Compute expert rating
        var expertResult = reviewRepository.findAverageExpertRatingsBySpotIds(List.of(id));
        if (!expertResult.isEmpty()) {
            expertAvg = (Double) expertResult.get(0)[1];
        }
        
        // Compute friends rating
        if (authenticatedUserId != null) {
            Set<Long> friendIds = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            if (!friendIds.isEmpty()) {
                var friendsResult = reviewRepository.findAverageFriendsRatingsBySpotIds(List.of(id), friendIds);
                if (!friendsResult.isEmpty()) {
                    friendsAvg = (Double) friendsResult.get(0)[1];
                }
            }
        }
        
        String activeMode = (ratingMode != null) ? ratingMode.toLowerCase() : "global";
        Double displayRating;
        if ("expert".equals(activeMode)) {
            displayRating = expertAvg;
        } else if ("friends".equals(activeMode) && authenticatedUserId != null) {
            displayRating = friendsAvg;
        } else {
            displayRating = globalAvg;
        }
        
        boolean isLiked = false;
        boolean isSaved = false;
        if (authenticatedUserId != null) {
            var interaction = interactionRepository.findByUserIdAndSpotId(authenticatedUserId, spot.getId());
            if (interaction.isPresent()) {
                isLiked = interaction.get().isLiked();
                isSaved = interaction.get().isSaved();
            }
        }
        
        int friendLikeCount = 0;
        if (authenticatedUserId != null) {
            Set<Long> friendIds = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            if (!friendIds.isEmpty()) {
                friendLikeCount = (int) interactionRepository.countFriendLikesBySpotId(id, friendIds);
            }
        }
        
        List<VibeTagDTO> vibeTags = loadVibeTags(id);
        com.radach.maps.model.User submitter = spot.getSubmittedBy() != null ? userRepository.findById(spot.getSubmittedBy()).orElse(null) : null;
        return new SpotResponse(
                spot, displayRating, globalAvg, expertAvg, friendsAvg, isLiked, isSaved, 
                submitter != null ? submitter.getId() : null,
                submitter != null ? submitter.getName() : null,
                submitter != null && submitter.isExpert(),
                vibeTags,
                friendLikeCount,
                activeMode
        );
    }

    /** Get the list of friends who liked a spot. */
    public List<FriendLikeDTO> getFriendLikes(Long spotId, Long userId) {
        Set<Long> friendIds = friendshipService.getFirstDegreeConnections(userId);
        if (friendIds.isEmpty()) return List.of();
        
        List<Long> friendUserIds = interactionRepository.findFriendUserIdsWhoLikedSpot(spotId, friendIds);
        if (friendUserIds.isEmpty()) return List.of();
        
        return userRepository.findAllById(friendUserIds).stream()
                .map(u -> new FriendLikeDTO(u.getId(), u.getName(), u.getProfilePicture()))
                .toList();
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

    public List<SpotResponse> getTrending(Long authenticatedUserId, Double lat, Double lng, Double radiusKm, String type) {
        boolean geoSearch = lat != null && lng != null && radiusKm != null;
        java.time.Instant since = java.time.Instant.now().minus(java.time.Duration.ofDays(7));

        if ("expert".equalsIgnoreCase(type)) {
            // Expert Reviews trending (accessible to everyone)
            List<Spot> spots = geoSearch
                    ? spotRepository.findExpertTrendingWithinRadius(lat, lng, radiusKm, since)
                    : spotRepository.findExpertTrending(since);
            return withRatingsAndInteractions(spots, authenticatedUserId);
        } else {
            // Personalized trending based on friends
            if (authenticatedUserId == null) {
                // Unauthenticated personalized ranking = global fallback
                List<Spot> spots = geoSearch
                        ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                        : spotRepository.findAllByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE);
                return withRatingsAndInteractions(spots, null);
            }

            Set<Long> firstDegree = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            Set<Long> secondDegree = friendshipService.getSecondDegreeConnections(authenticatedUserId);
            
            if (firstDegree.isEmpty() && secondDegree.isEmpty()) {
                // Fallback to global if they have no friends
                List<Spot> spots = geoSearch
                        ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                        : spotRepository.findAllByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE);
                return withRatingsAndInteractions(spots, authenticatedUserId);
            }

            // Safe collections for SQL IN clause to prevent syntax errors
            Set<Long> safeFirstDegree = firstDegree.isEmpty() ? Set.of(-1L) : firstDegree;
            Set<Long> safeSecondDegree = secondDegree.isEmpty() ? Set.of(-1L) : secondDegree;

            List<Spot> spots = geoSearch
                    ? spotRepository.findPersonalizedTrendingWithinRadius(lat, lng, radiusKm, safeFirstDegree, safeSecondDegree, since)
                    : spotRepository.findPersonalizedTrending(safeFirstDegree, safeSecondDegree, since);

            return withRatingsAndInteractions(spots, authenticatedUserId);
        }
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
        return search(q, authenticatedUserId, "global");
    }

    public List<SpotResponse> search(String q, Long authenticatedUserId, String ratingMode) {
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
            return withRatingsAndInteractions(spotRepository.findByVibeTagName(vibeName), authenticatedUserId, ratingMode);
        }
        return withRatingsAndInteractions(spotRepository.searchByNameOrTag(trimmed), authenticatedUserId, ratingMode);
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
        return getSavedSpots(userId, "global");
    }

    public List<SpotResponse> getSavedSpots(Long userId, String ratingMode) {
        Set<Long> savedIds = interactionRepository.findSavedSpotIdsByUserId(userId);
        if (savedIds.isEmpty()) return List.of();
        
        List<Spot> spots = spotRepository.findAllById(savedIds);
        return withRatingsAndInteractions(spots, userId, ratingMode);
    }
}
