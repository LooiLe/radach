package com.radach.maps.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.MapSpotResponse;
import com.radach.maps.dto.SpotRequest;
import com.radach.maps.dto.SpotClusterResponse;
import com.radach.maps.dto.SpotMapResponse;
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
    private static final int DEFAULT_SPOT_LIMIT = 500;
    private static final int MAX_SPOT_LIMIT = 1000;
    private static final int MAP_SPOT_LIMIT = 5000;
    private static final int MAP_CLUSTER_LIMIT = 2500;
    private static final int MAP_CLUSTER_UNTIL_ZOOM = 12;

    private final SpotRepository spotRepository;
    private final ReviewRepository reviewRepository;
    private final FriendshipService friendshipService;
    private final com.radach.maps.repository.SpotEventRepository spotEventRepository;
    private final com.radach.maps.repository.UserSpotInteractionRepository interactionRepository;

    private final com.radach.maps.repository.UserRepository userRepository;
    private final SpotVibeTagRepository spotVibeRepo;
    private final VibeTagDefinitionRepository vibeDefRepo;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public SpotService(SpotRepository spotRepository, ReviewRepository reviewRepository, FriendshipService friendshipService, com.radach.maps.repository.SpotEventRepository spotEventRepository, com.radach.maps.repository.UserSpotInteractionRepository interactionRepository, com.radach.maps.repository.UserRepository userRepository, SpotVibeTagRepository spotVibeRepo, VibeTagDefinitionRepository vibeDefRepo, NamedParameterJdbcTemplate jdbcTemplate) {
        this.spotRepository = spotRepository;
        this.reviewRepository = reviewRepository;
        this.friendshipService = friendshipService;
        this.spotEventRepository = spotEventRepository;
        this.interactionRepository = interactionRepository;
        this.userRepository = userRepository;
        this.spotVibeRepo = spotVibeRepo;
        this.vibeDefRepo = vibeDefRepo;
        this.jdbcTemplate = jdbcTemplate;
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
        List<SpotVibeTag> spotVibeTags = spotVibeRepo.findBySpotIdIn(spotIds);
        List<Long> vibeTagIds = spotVibeTags.stream()
                .map(SpotVibeTag::getVibeTagId)
                .distinct()
                .toList();

        Map<Long, VibeTagDefinition> vibeDefs = vibeTagIds.isEmpty() ? Map.of() :
                vibeDefRepo.findAllById(vibeTagIds).stream()
                        .collect(Collectors.toMap(VibeTagDefinition::getId, java.util.function.Function.identity()));

        Map<Long, List<SpotVibeTag>> tagsBySpotId = spotVibeTags.stream()
                .collect(Collectors.groupingBy(SpotVibeTag::getSpotId));

        Map<Long, List<VibeTagDTO>> vibeTagMap = spotIds.stream()
                .collect(Collectors.toMap(
                        id -> id,
                        id -> {
                            List<SpotVibeTag> svts = tagsBySpotId.getOrDefault(id, List.of());
                            return svts.stream()
                                    .map(svt -> {
                                        VibeTagDefinition def = vibeDefs.get(svt.getVibeTagId());
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
                                    .filter(java.util.Objects::nonNull)
                                    .toList();
                        }
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
    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Integer limit, Long authenticatedUserId) {
        boolean geoSearch = lat != null || lng != null || radiusKm != null;
        if (geoSearch && (lat == null || lng == null || radiusKm == null)) {
            throw new IllegalArgumentException("lat, lng, and radiusKm are required for geo search");
        }
        if (radiusKm != null && radiusKm <= 0) {
            throw new IllegalArgumentException("radiusKm must be greater than 0");
        }

        boolean sortPopularity = "popularity".equalsIgnoreCase(sortBy);
        int effectiveLimit = normalizeSpotLimit(limit);

        List<Spot> spots;
        if (geoSearch) {
            spots = sortPopularity 
                    ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                    : spotRepository.findWithinRadius(lat, lng, radiusKm);
            if (spots.size() > effectiveLimit) {
                spots = spots.subList(0, effectiveLimit);
            }
        } else {
            spots = sortPopularity
                    ? spotRepository.findByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE, PageRequest.of(0, effectiveLimit))
                    : spotRepository.findByStatus(SpotStatus.ACTIVE, PageRequest.of(0, effectiveLimit));
        }

        return withRatingsAndInteractions(spots, authenticatedUserId);
    }

    public SpotMapResponse findMapSpots(Double swLat, Double swLng, Double neLat, Double neLng, Integer zoom) {
        validateMapBounds(swLat, swLng, neLat, neLng);
        int effectiveZoom = zoom == null ? 6 : Math.max(0, Math.min(22, zoom));
        MapSqlParameterSource params = mapBoundsParams(swLat, swLng, neLat, neLng);
        long total = countMapSpots(params);

        if (effectiveZoom <= MAP_CLUSTER_UNTIL_ZOOM || total > MAP_SPOT_LIMIT) {
            MapBucketResponses buckets = findMapBuckets(params, swLat, swLng, neLat, neLng, effectiveZoom);
            return SpotMapResponse.clusters(total, buckets.spots(), buckets.clusters());
        }

        params.addValue("limit", MAP_SPOT_LIMIT);
        List<MapSpotResponse> spots = jdbcTemplate.query("""
                SELECT id, name, type, latitude, longitude, rank_score
                FROM spots
                WHERE status = 'ACTIVE'
                  AND latitude BETWEEN :swLat AND :neLat
                  AND longitude BETWEEN :swLng AND :neLng
                ORDER BY rank_score DESC, id DESC
                LIMIT :limit
                """, params, (rs, rowNum) -> new MapSpotResponse(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getString("type"),
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getInt("rank_score")
        ));

        return SpotMapResponse.spots(total, total > MAP_SPOT_LIMIT, spots);
    }

    private void validateMapBounds(Double swLat, Double swLng, Double neLat, Double neLng) {
        if (swLat == null || swLng == null || neLat == null || neLng == null) {
            throw new IllegalArgumentException("swLat, swLng, neLat, and neLng are required");
        }
        if (swLat < -90 || neLat > 90 || swLng < -180 || neLng > 180 || swLat >= neLat || swLng >= neLng) {
            throw new IllegalArgumentException("Invalid map bounds");
        }
    }

    private MapSqlParameterSource mapBoundsParams(Double swLat, Double swLng, Double neLat, Double neLng) {
        return new MapSqlParameterSource()
                .addValue("swLat", swLat)
                .addValue("swLng", swLng)
                .addValue("neLat", neLat)
                .addValue("neLng", neLng);
    }

    private long countMapSpots(MapSqlParameterSource params) {
        Long total = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM spots
                WHERE status = 'ACTIVE'
                  AND latitude BETWEEN :swLat AND :neLat
                  AND longitude BETWEEN :swLng AND :neLng
                """, params, Long.class);
        return total == null ? 0 : total;
    }

    private MapBucketResponses findMapBuckets(MapSqlParameterSource params, double swLat, double swLng, double neLat, double neLng, int zoom) {
        double latStep = clusterStep(neLat - swLat, zoom);
        double lngStep = clusterStep(neLng - swLng, zoom);
        params.addValue("latStep", latStep);
        params.addValue("lngStep", lngStep);
        params.addValue("limit", MAP_CLUSTER_LIMIT);

        List<MapBucketResponse> buckets = jdbcTemplate.query("""
                WITH bucketed AS (
                    SELECT
                        id,
                        name,
                        floor((latitude - :swLat) / :latStep) AS lat_bucket,
                        floor((longitude - :swLng) / :lngStep) AS lng_bucket,
                        latitude,
                        longitude,
                        type,
                        rank_score
                    FROM spots
                    WHERE status = 'ACTIVE'
                      AND latitude BETWEEN :swLat AND :neLat
                      AND longitude BETWEEN :swLng AND :neLng
                )
                SELECT
                    AVG(latitude) AS latitude,
                    AVG(longitude) AS longitude,
                    COUNT(*) AS spot_count,
                    (array_agg(id ORDER BY rank_score DESC, id DESC))[1] AS spot_id,
                    (array_agg(name ORDER BY rank_score DESC, id DESC))[1] AS name,
                    (array_agg(type ORDER BY rank_score DESC, id DESC))[1] AS type,
                    (array_agg(rank_score ORDER BY rank_score DESC, id DESC))[1] AS rank_score
                FROM bucketed
                GROUP BY lat_bucket, lng_bucket
                ORDER BY spot_count DESC
                LIMIT :limit
                """, params, (rs, rowNum) -> new MapBucketResponse(
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getLong("spot_count"),
                rs.getLong("spot_id"),
                rs.getString("name"),
                rs.getString("type"),
                rs.getInt("rank_score")
        ));

        List<MapSpotResponse> spots = buckets.stream()
                .filter(bucket -> bucket.count() == 1)
                .map(bucket -> new MapSpotResponse(
                        bucket.spotId(),
                        bucket.name(),
                        bucket.type(),
                        bucket.latitude(),
                        bucket.longitude(),
                        bucket.rankScore()
                ))
                .toList();

        List<SpotClusterResponse> clusters = buckets.stream()
                .filter(bucket -> bucket.count() > 1)
                .map(bucket -> new SpotClusterResponse(
                        bucket.latitude(),
                        bucket.longitude(),
                        bucket.count(),
                        bucket.type()
                ))
                .toList();

        return new MapBucketResponses(spots, clusters);
    }

    private double clusterStep(double span, int zoom) {
        double cellsAcrossViewport = Math.max(8, Math.min(64, Math.pow(2, Math.max(0, zoom - 4))));
        return Math.max(span / cellsAcrossViewport, 0.0001);
    }

    private record MapBucketResponse(
            Double latitude,
            Double longitude,
            long count,
            Long spotId,
            String name,
            String type,
            int rankScore
    ) {
    }

    private record MapBucketResponses(
            List<MapSpotResponse> spots,
            List<SpotClusterResponse> clusters
    ) {
    }

    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Long authenticatedUserId) {
        return findSpots(lat, lng, radiusKm, sortBy, null, authenticatedUserId);
    }

    private int normalizeSpotLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_SPOT_LIMIT;
        }
        if (limit <= 0) {
            throw new IllegalArgumentException("limit must be greater than 0");
        }
        return Math.min(limit, MAX_SPOT_LIMIT);
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

    public List<SpotResponse> getTrending(Long authenticatedUserId, Double lat, Double lng, Double radiusKm, String type) {
        return getTrending(authenticatedUserId, lat, lng, radiusKm, type, null);
    }

    public List<SpotResponse> getTrending(Long authenticatedUserId, Double lat, Double lng, Double radiusKm, String type, Integer limit) {
        boolean geoSearch = lat != null && lng != null && radiusKm != null;
        java.time.Instant since = java.time.Instant.now().minus(java.time.Duration.ofDays(7));
        int effectiveLimit = normalizeSpotLimit(limit);

        if ("expert".equalsIgnoreCase(type)) {
            // Expert Reviews trending (accessible to everyone)
            List<Spot> spots = geoSearch
                    ? spotRepository.findExpertTrendingWithinRadius(lat, lng, radiusKm, since)
                    : spotRepository.findExpertTrending(since);
            spots = limitSpots(spots, effectiveLimit);
            return withRatingsAndInteractions(spots, authenticatedUserId);
        } else {
            // Personalized trending based on friends
            if (authenticatedUserId == null) {
                // Unauthenticated personalized ranking = global fallback
                List<Spot> spots = geoSearch
                        ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                        : spotRepository.findByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE, PageRequest.of(0, effectiveLimit));
                spots = limitSpots(spots, effectiveLimit);
                return withRatingsAndInteractions(spots, null);
            }

            Set<Long> firstDegree = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            Set<Long> secondDegree = friendshipService.getSecondDegreeConnections(authenticatedUserId);
            
            if (firstDegree.isEmpty() && secondDegree.isEmpty()) {
                // Fallback to global if they have no friends
                List<Spot> spots = geoSearch
                        ? spotRepository.findWithinRadiusOrderByRankScoreDesc(lat, lng, radiusKm)
                        : spotRepository.findByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE, PageRequest.of(0, effectiveLimit));
                spots = limitSpots(spots, effectiveLimit);
                return withRatingsAndInteractions(spots, authenticatedUserId);
            }

            // Safe collections for SQL IN clause to prevent syntax errors
            Set<Long> safeFirstDegree = firstDegree.isEmpty() ? Set.of(-1L) : firstDegree;
            Set<Long> safeSecondDegree = secondDegree.isEmpty() ? Set.of(-1L) : secondDegree;

            List<Spot> spots = geoSearch
                    ? spotRepository.findPersonalizedTrendingWithinRadius(lat, lng, radiusKm, safeFirstDegree, safeSecondDegree, since)
                    : spotRepository.findPersonalizedTrending(safeFirstDegree, safeSecondDegree, since);

            spots = limitSpots(spots, effectiveLimit);
            return withRatingsAndInteractions(spots, authenticatedUserId);
        }
    }

    private List<Spot> limitSpots(List<Spot> spots, int limit) {
        return spots.size() > limit ? spots.subList(0, limit) : spots;
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

    public List<SpotResponse> search(String q, Integer limit, Long authenticatedUserId) {
        if (q == null || q.isBlank()) {
            throw new IllegalArgumentException("Search query is required");
        }
        String trimmed = q.trim();
        int effectiveLimit = limit != null && limit > 0 ? Math.min(limit, 100) : 100;
        List<Spot> spots;
        // Handle vibe: prefix — search by vibe tag name
        if (trimmed.toLowerCase().startsWith("vibe:")) {
            String vibeName = trimmed.substring(5).trim();
            if (vibeName.isEmpty()) {
                throw new IllegalArgumentException("Vibe tag name is required after 'vibe:'");
            }
            spots = spotRepository.findByVibeTagName(vibeName, effectiveLimit);
        } else {
            spots = spotRepository.searchByNameOrTag(trimmed, effectiveLimit);
        }

        return withRatingsAndInteractions(spots, authenticatedUserId);
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
