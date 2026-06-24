package com.radach.maps.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.radach.maps.dto.FriendLikeDTO;

import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.dto.CategoryCluster;
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
    private static final int DEFAULT_SPOT_LIMIT = 100;
    private static final int MAX_SPOT_LIMIT = 100;
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
    private final FollowService followService;

    public SpotService(SpotRepository spotRepository, ReviewRepository reviewRepository, FriendshipService friendshipService, com.radach.maps.repository.SpotEventRepository spotEventRepository, com.radach.maps.repository.UserSpotInteractionRepository interactionRepository, com.radach.maps.repository.UserRepository userRepository, SpotVibeTagRepository spotVibeRepo, VibeTagDefinitionRepository vibeDefRepo, NamedParameterJdbcTemplate jdbcTemplate, FollowService followService) {
        this.spotRepository = spotRepository;
        this.reviewRepository = reviewRepository;
        this.friendshipService = friendshipService;
        this.spotEventRepository = spotEventRepository;
        this.interactionRepository = interactionRepository;
        this.userRepository = userRepository;
        this.spotVibeRepo = spotVibeRepo;
        this.vibeDefRepo = vibeDefRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.followService = followService;
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

        // Compute trusted ratings (friends + followed experts)
        Map<Long, Double> trustedRatings;
        if (authenticatedUserId != null) {
            Set<Long> friendIds = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            Set<Long> followedExpertIds = followService.getFollowedExpertIds(authenticatedUserId);
            Set<Long> trustedIds = new java.util.HashSet<>(friendIds);
            trustedIds.addAll(followedExpertIds);
            if (!trustedIds.isEmpty()) {
                trustedRatings = reviewRepository.findAverageFriendsRatingsBySpotIds(spotIds, trustedIds)
                        .stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> (Double) row[1]
                        ));
            } else {
                trustedRatings = Map.of();
            }
        } else {
            trustedRatings = Map.of();
        }

        // Select which rating to display based on mode
        Map<Long, Double> displayRatings;
        if ("expert".equals(activeMode)) {
            displayRatings = expertRatings;
        } else if ("trusted".equals(activeMode) && authenticatedUserId != null) {
            displayRatings = trustedRatings;
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
    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Long authenticatedUserId, String ratingMode) {
        return findSpots(lat, lng, radiusKm, sortBy, null, authenticatedUserId, ratingMode);
    }

    public List<SpotResponse> findSpots(Double lat, Double lng, Double radiusKm, String sortBy, Integer limit, Long authenticatedUserId, String ratingMode) {
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
                    ? spotRepository.findAllByStatusOrderByRankScoreDesc(SpotStatus.ACTIVE)
                    : spotRepository.findAllByStatus(SpotStatus.ACTIVE);
            if (spots.size() > effectiveLimit) {
                spots = spots.subList(0, effectiveLimit);
            }
        }

        return withRatingsAndInteractions(spots, authenticatedUserId, ratingMode);
    }

    private static final Map<String, String> TYPE_ICON_MAP = Map.of(
        "restaurant", "/icons/material-symbols-light--chef-hat-outline.svg",
        "bar", "/icons/guidance--bar.svg",
        "hotel", "/icons/material-symbols-light--hotel-outline-rounded.svg",
        "cafe", "/icons/carbon--cafe.svg",
        "food hall", "/icons/material-symbols-light--chef-hat-outline.svg",
        "beach", "/icons/streamline-plump--beach.svg",
        "market", "/icons/healthicons--market-stall-outline.svg",
        "attraction", "/icons/material-symbols-light--attractions-outline-rounded.svg",
        "viewpoint", "/icons/game-icons--hill-conquest.svg"
    );

    private static final String DEFAULT_ICON = "/icons/stash--pin-location-light.svg";

    public SpotMapResponse findMapSpots(Double swLat, Double swLng, Double neLat, Double neLng, Integer zoom, String typeFilter, String ratingMode, Long authenticatedUserId) {
        validateMapBounds(swLat, swLng, neLat, neLng);
        int effectiveZoom = zoom == null ? 6 : Math.max(0, Math.min(22, zoom));
        MapSqlParameterSource params = mapBoundsParams(swLat, swLng, neLat, neLng);

        // Build WHERE clause with optional type filter
        StringBuilder whereClause = new StringBuilder(
            "s.status = 'ACTIVE' AND s.latitude BETWEEN :swLat AND :neLat AND s.longitude BETWEEN :swLng AND :neLng"
        );
        if (typeFilter != null && !typeFilter.isBlank()) {
            String norm = typeFilter.trim().toLowerCase();
            if (norm.equals("accommodations")) {
                whereClause.append(" AND LOWER(s.type) IN ('accommodations', 'hotel')");
            } else if (norm.equals("activities")) {
                whereClause.append(" AND LOWER(s.type) IN ('activity', 'activities', 'attraction', 'attractions')");
            } else if (norm.equals("children")) {
                whereClause.append(" AND LOWER(s.type) IN ('child', 'children')");
            } else if (norm.equals("viewpoint")) {
                whereClause.append(" AND LOWER(s.type) IN ('viewpoint', 'viewpoints')");
            } else if (norm.equals("restaurant")) {
                whereClause.append(" AND LOWER(s.type) IN ('restaurant', 'food hall')");
            } else if (norm.equals("cafe")) {
                whereClause.append(" AND LOWER(s.type) IN ('cafe', 'café')");
            } else {
                whereClause.append(" AND LOWER(s.type) = :typeFilter");
                params.addValue("typeFilter", norm);
            }
        }

        // Count query — use a separate params copy to avoid extraneous params
        MapSqlParameterSource countParams = new MapSqlParameterSource()
            .addValue("swLat", swLat)
            .addValue("swLng", swLng)
            .addValue("neLat", neLat)
            .addValue("neLng", neLng);
        String countWhere = "status = 'ACTIVE' AND latitude BETWEEN :swLat AND :neLat AND longitude BETWEEN :swLng AND :neLng";
        if (typeFilter != null && !typeFilter.isBlank()) {
            String norm = typeFilter.trim().toLowerCase();
            if (norm.equals("accommodations")) {
                countWhere += " AND LOWER(type) IN ('accommodations', 'hotel')";
            } else if (norm.equals("activities")) {
                countWhere += " AND LOWER(type) IN ('activity', 'activities', 'attraction', 'attractions')";
            } else if (norm.equals("children")) {
                countWhere += " AND LOWER(type) IN ('child', 'children')";
            } else if (norm.equals("viewpoint")) {
                countWhere += " AND LOWER(type) IN ('viewpoint', 'viewpoints')";
            } else if (norm.equals("restaurant")) {
                countWhere += " AND LOWER(type) IN ('restaurant', 'food hall')";
            } else if (norm.equals("cafe")) {
                countWhere += " AND LOWER(type) IN ('cafe', 'café')";
            } else {
                countWhere += " AND LOWER(type) = :typeFilter";
                countParams.addValue("typeFilter", norm);
            }
        }
        Long totalObj = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM spots WHERE " + countWhere, countParams, Long.class
        );
        long total = totalObj != null ? totalObj : 0L;

        // Choose rating subquery based on mode
        String ratingSubquery;
        String activeMode = (ratingMode != null) ? ratingMode.toLowerCase() : "global";
        if ("expert".equals(activeMode)) {
            ratingSubquery = "(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r JOIN users u ON u.id = r.author_id WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND u.is_expert = true)";
        } else if ("trusted".equals(activeMode) && authenticatedUserId != null) {
            Set<Long> trustedIds = new java.util.HashSet<>(friendshipService.getFirstDegreeConnections(authenticatedUserId));
            trustedIds.addAll(followService.getFollowedExpertIds(authenticatedUserId));
            if (!trustedIds.isEmpty()) {
                ratingSubquery = "(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED' AND r.author_id IN (" + trustedIds.stream().map(String::valueOf).collect(Collectors.joining(",")) + "))";
            } else {
                ratingSubquery = "0.0";
            }
        } else {
            ratingSubquery = "(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.spot_id = s.id AND r.status = 'APPROVED')";
        }

        // Return up to MAP_SPOT_LIMIT spots — frontend handles pagination of the results
        params.addValue("limit", MAP_SPOT_LIMIT);
        String sql = "SELECT s.id, s.name, s.type, s.latitude, s.longitude, s.rank_score, COALESCE(" + ratingSubquery + ", 0.0) as avg_rating " +
            "FROM spots s WHERE " + whereClause +
            " ORDER BY s.rank_score DESC, s.id DESC LIMIT :limit";

        // Query upcoming events in the viewport (next 14 days)
        long EVENT_LOOKAHEAD_DAYS = 14;
        Map<Long, Set<String>> spotActiveCategories = new java.util.HashMap<>();
        try {
            Instant periodStart = java.time.LocalDate.now(java.time.ZoneOffset.UTC).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            Instant periodEnd = periodStart.plus(java.time.Duration.ofDays(EVENT_LOOKAHEAD_DAYS));

            MapSqlParameterSource eventParams = new MapSqlParameterSource()
                .addValue("swLat", swLat)
                .addValue("swLng", swLng)
                .addValue("neLat", neLat)
                .addValue("neLng", neLng)
                .addValue("periodStart", java.sql.Timestamp.from(periodStart))
                .addValue("periodEnd", java.sql.Timestamp.from(periodEnd));

            boolean hasCategoryCol = hasColumn("events", "category");
            boolean hasStatusCol = hasColumn("events", "status");
            boolean hasRecurrenceCol = hasColumn("events", "recurrence_rule");

            String baseSelect = "SELECT e.id, e.spot_id, e.start_time, e.end_time";
            String recurrenceSelect = hasRecurrenceCol ? ", e.recurrence_rule" : ", NULL AS recurrence_rule";
            String categorySelect = hasCategoryCol ? ", e.category" : ", NULL AS category";
            String statusFilter = hasStatusCol ? " AND e.status = 'ACTIVE'" : "";
            String spotStatusFilter = " AND s.status = 'ACTIVE'";

            StringBuilder eventWhere = new StringBuilder()
                .append("s.latitude BETWEEN :swLat AND :neLat ")
                .append("AND s.longitude BETWEEN :swLng AND :neLng ");

            if (hasRecurrenceCol) {
                eventWhere
                    .append("AND (")
                    // Non-recurring: event starts within the lookahead window OR is already in progress
                    .append("(e.recurrence_rule IS NULL AND e.start_time >= :periodStart AND e.start_time < :periodEnd)")
                    .append(" OR ")
                    // Recurring: base start_time is before period ends (the Java check handles recurrence matching)
                    .append("(e.recurrence_rule IS NOT NULL AND e.start_time < :periodEnd)")
                    .append(")");
            } else {
                // No recurrence_rule column — all events treated as non-recurring
                eventWhere
                    .append("AND e.start_time >= :periodStart AND e.start_time < :periodEnd");
            }

            String eventSql = baseSelect + recurrenceSelect + categorySelect +
                " FROM events e JOIN spots s ON e.spot_id = s.id" +
                " WHERE 1=1" + statusFilter + spotStatusFilter + " AND " + eventWhere;

            if (eventSql != null) {
                class EventCandidate {
                    final Long spotId;
                    final String category;
                    final Instant startTime;
                    final Instant endTime;
                    final String recurrenceRule;
                    EventCandidate(Long spotId, String category, Instant startTime, Instant endTime, String recurrenceRule) {
                        this.spotId = spotId;
                        this.category = category;
                        this.startTime = startTime;
                        this.endTime = endTime;
                        this.recurrenceRule = recurrenceRule;
                    }
                }

                List<EventCandidate> candidates = jdbcTemplate.query(eventSql, eventParams, (rs, rowNum) -> {
                    java.sql.Timestamp startTs = rs.getTimestamp("start_time");
                    java.sql.Timestamp endTs = rs.getTimestamp("end_time");
                    return new EventCandidate(
                        rs.getLong("spot_id"),
                        rs.getString("category"),
                        startTs != null ? startTs.toInstant() : null,
                        endTs != null ? endTs.toInstant() : null,
                        rs.getString("recurrence_rule")
                    );
                });

                for (EventCandidate c : candidates) {
                    if (c.startTime != null && isEventActiveInPeriod(c.startTime, c.endTime, c.recurrenceRule, periodStart, periodEnd)) {
                        String cat = c.category != null ? c.category.trim() : "Other";
                        spotActiveCategories.computeIfAbsent(c.spotId, k -> new java.util.HashSet<>()).add(cat);
                    }
                }
            }
        } catch (Exception e) {
            // If events query fails for any reason, gracefully continue without event data
            System.err.println("Failed to load events for map: " + e.getMessage());
        }

        List<MapSpotResponse> spots = jdbcTemplate.query(
            sql, params, (rs, rowNum) -> {
                long spotId = rs.getLong("id");
                boolean hasEvent = spotActiveCategories.containsKey(spotId);
                String activeCats = hasEvent ? String.join(",", spotActiveCategories.get(spotId)) : null;
                return new MapSpotResponse(
                    spotId,
                    rs.getString("name"),
                    rs.getString("type"),
                    rs.getDouble("latitude"),
                    rs.getDouble("longitude"),
                    rs.getInt("rank_score"),
                    rs.getDouble("avg_rating"),
                    hasEvent,
                    activeCats,
                    List.of()
                );
            }
        );

        if (!spots.isEmpty()) {
            List<Long> spotIds = spots.stream().map(MapSpotResponse::id).toList();
            List<SpotVibeTag> spotVibes = spotVibeRepo.findBySpotIdIn(spotIds);
            Map<Long, List<Long>> spotVibeMap = spotVibes.stream()
                .collect(Collectors.groupingBy(
                    SpotVibeTag::getSpotId,
                    Collectors.mapping(SpotVibeTag::getVibeTagId, Collectors.toList())
                ));
            spots = spots.stream().map(s -> new MapSpotResponse(
                s.id(),
                s.name(),
                s.type(),
                s.latitude(),
                s.longitude(),
                s.rankScore(),
                s.averageRating(),
                s.hasActiveEvent(),
                s.activeEventCategories(),
                spotVibeMap.getOrDefault(s.id(), List.of())
            )).toList();
        }

        return SpotMapResponse.spots(total, total > MAP_SPOT_LIMIT, spots);
    }

    private boolean hasTable(String table) {
        try {
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE 1=0", new MapSqlParameterSource(), Long.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasColumn(String table, String column) {
        try {
            jdbcTemplate.query("SELECT " + column + " FROM " + table + " WHERE 1=0", new MapSqlParameterSource(), rs -> null);
            return true;
        } catch (Exception e) {
            return false;
        }
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
                        bucket.rankScore(),
                        0.0,
                        false,
                        null,
                        List.of()
                ))
                .toList();

        if (!spots.isEmpty()) {
            List<Long> spotIds = spots.stream().map(MapSpotResponse::id).toList();
            List<SpotVibeTag> spotVibes = spotVibeRepo.findBySpotIdIn(spotIds);
            Map<Long, List<Long>> spotVibeMap = spotVibes.stream()
                .collect(Collectors.groupingBy(
                    SpotVibeTag::getSpotId,
                    Collectors.mapping(SpotVibeTag::getVibeTagId, Collectors.toList())
                ));
            spots = spots.stream().map(s -> new MapSpotResponse(
                s.id(),
                s.name(),
                s.type(),
                s.latitude(),
                s.longitude(),
                s.rankScore(),
                s.averageRating(),
                s.hasActiveEvent(),
                s.activeEventCategories(),
                spotVibeMap.getOrDefault(s.id(), List.of())
            )).toList();
        }

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
        return findSpots(lat, lng, radiusKm, sortBy, null, authenticatedUserId, "global");
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
        
        // Compute trusted rating (friends + followed experts)
        Double trustedAvg = 0.0;
        if (authenticatedUserId != null) {
            Set<Long> friendIds = friendshipService.getFirstDegreeConnections(authenticatedUserId);
            Set<Long> followedExpertIds = followService.getFollowedExpertIds(authenticatedUserId);
            Set<Long> trustedIds = new java.util.HashSet<>(friendIds);
            trustedIds.addAll(followedExpertIds);
            if (!trustedIds.isEmpty()) {
                var trustedResult = reviewRepository.findAverageFriendsRatingsBySpotIds(List.of(id), trustedIds);
                if (!trustedResult.isEmpty()) {
                    trustedAvg = (Double) trustedResult.get(0)[1];
                }
            }
        }
        
        String activeMode = (ratingMode != null) ? ratingMode.toLowerCase() : "global";
        Double displayRating;
        if ("expert".equals(activeMode)) {
            displayRating = expertAvg;
        } else if ("trusted".equals(activeMode) && authenticatedUserId != null) {
            displayRating = trustedAvg;
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

    public List<SpotResponse> search(String q, Long authenticatedUserId, String ratingMode) {
        return search(q, null, authenticatedUserId, ratingMode);
    }

    public List<SpotResponse> search(String q, Integer limit, Long authenticatedUserId, String ratingMode) {
        if (q == null || q.isBlank()) {
            throw new IllegalArgumentException("Search query is required");
        }
        String trimmed = q.trim();
        int effectiveLimit = limit != null && limit > 0 ? Math.min(limit, MAX_SPOT_LIMIT) : MAX_SPOT_LIMIT;
        // Handle vibe: prefix — search by vibe tag name
        if (trimmed.toLowerCase().startsWith("vibe:")) {
            String vibeName = trimmed.substring(5).trim();
            if (vibeName.isEmpty()) {
                throw new IllegalArgumentException("Vibe tag name is required after 'vibe:'");
            }
            List<Spot> spots = spotRepository.findByVibeTagName(vibeName);
            if (spots.size() > effectiveLimit) {
                spots = spots.subList(0, effectiveLimit);
            }
            return withRatingsAndInteractions(spots, authenticatedUserId, ratingMode);
        }
        List<Spot> spots = spotRepository.searchByNameOrTag(trimmed);
        if (spots.size() > effectiveLimit) {
            spots = spots.subList(0, effectiveLimit);
        }
        return withRatingsAndInteractions(spots, authenticatedUserId, ratingMode);
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

    private boolean isEventActiveInPeriod(Instant startTime, Instant endTime, String recurrenceRule, Instant periodStart, Instant periodEnd) {
        // 1. Non-recurring events
        if (recurrenceRule == null || recurrenceRule.isBlank()) {
            Instant end = endTime != null ? endTime : startTime;
            return !end.isBefore(periodStart) && !startTime.isAfter(periodEnd);
        }

        // 2. Recurring events — check if any occurrence falls within the period
        // Event starts after the entire lookahead period — skip
        if (startTime.isAfter(periodEnd)) {
            return false;
        }

        // Check if the recurrence has already ended before the period starts
        if (recurrenceRule.contains("UNTIL=")) {
            int index = recurrenceRule.indexOf("UNTIL=");
            String sub = recurrenceRule.substring(index + 6);
            int endOfUntil = sub.indexOf(";");
            String untilStr = endOfUntil != -1 ? sub.substring(0, endOfUntil) : sub;
            try {
                Instant untilInstant;
                if (untilStr.endsWith("Z")) {
                    untilStr = untilStr.substring(0, untilStr.length() - 1);
                }
                if (untilStr.contains("T")) {
                    java.time.LocalDateTime ldt = java.time.LocalDateTime.parse(
                            untilStr,
                            java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss")
                    );
                    untilInstant = ldt.toInstant(java.time.ZoneOffset.UTC);
                } else {
                    java.time.LocalDate ld = java.time.LocalDate.parse(
                            untilStr,
                            java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd")
                    );
                    untilInstant = ld.atTime(23, 59, 59).atZone(java.time.ZoneOffset.UTC).toInstant();
                }
                if (untilInstant.isBefore(periodStart)) {
                    return false;
                }
            } catch (Exception ex) {
                // ignore and assume not ended
            }
        }

        ZonedDateTime eventTime = startTime.atZone(ZoneOffset.UTC);
        ZonedDateTime startLdt = periodStart.atZone(ZoneOffset.UTC);
        ZonedDateTime endLdt = periodEnd.atZone(ZoneOffset.UTC);

        boolean supportedFreq = recurrenceRule.contains("FREQ=DAILY") ||
                                recurrenceRule.contains("FREQ=WEEKLY") ||
                                recurrenceRule.contains("FREQ=MONTHLY") ||
                                recurrenceRule.contains("FREQ=YEARLY");

        if (!supportedFreq) {
            return true; // Fallback for unsupported rules
        }

        // Check day-by-day within the lookahead window
        for (ZonedDateTime targetTime = startLdt; targetTime.isBefore(endLdt); targetTime = targetTime.plusDays(1)) {
            java.time.LocalDate targetDate = targetTime.toLocalDate();

            // Check if the event is excluded on this date via EXDATE
            if (recurrenceRule.contains("EXDATE=")) {
                String dateStr = String.format("%d%02d%02dT", targetDate.getYear(), targetDate.getMonthValue(), targetDate.getDayOfMonth());
                if (recurrenceRule.contains(dateStr)) {
                    continue;
                }
            }

            if (recurrenceRule.contains("FREQ=DAILY")) {
                return true;
            }
            if (recurrenceRule.contains("FREQ=WEEKLY")) {
                if (recurrenceRule.contains("INTERVAL=2")) {
                    long weeksDiff = java.time.temporal.ChronoUnit.WEEKS.between(eventTime.toLocalDate(), targetDate);
                    if (eventTime.getDayOfWeek() == targetTime.getDayOfWeek() && weeksDiff % 2 == 0) {
                        return true;
                    }
                } else {
                    if (eventTime.getDayOfWeek() == targetTime.getDayOfWeek()) {
                        return true;
                    }
                }
            }
            if (recurrenceRule.contains("FREQ=MONTHLY")) {
                if (eventTime.getDayOfMonth() == targetTime.getDayOfMonth()) {
                    return true;
                }
            }
            if (recurrenceRule.contains("FREQ=YEARLY")) {
                if (eventTime.getDayOfMonth() == targetTime.getDayOfMonth() && eventTime.getMonth() == targetTime.getMonth()) {
                    return true;
                }
            }
        }

        return false;
    }
}
