package com.radach.maps.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.radach.maps.model.Review;
import com.radach.maps.model.Spot;
import com.radach.maps.model.SpotEvent;
import com.radach.maps.model.UserSpotInteraction;
import com.radach.maps.repository.ReviewRepository;
import com.radach.maps.repository.SpotEventRepository;
import com.radach.maps.repository.SpotRepository;
import com.radach.maps.repository.UserSpotInteractionRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class FeedService {

    private final SpotEventRepository spotEventRepository;
    private final ReviewRepository reviewRepository;
    private final UserSpotInteractionRepository interactionRepository;
    private final FriendshipService friendshipService;
    private final UserRepository userRepository;
    private final SpotRepository spotRepository;

    public FeedService(
            SpotEventRepository spotEventRepository,
            ReviewRepository reviewRepository,
            UserSpotInteractionRepository interactionRepository,
            FriendshipService friendshipService,
            UserRepository userRepository,
            SpotRepository spotRepository
    ) {
        this.spotEventRepository = spotEventRepository;
        this.reviewRepository = reviewRepository;
        this.interactionRepository = interactionRepository;
        this.friendshipService = friendshipService;
        this.userRepository = userRepository;
        this.spotRepository = spotRepository;
    }

    /**
     * Build a friend activity feed for the given user.
     * Returns up to `limit` recent activities from the user's first-degree friends.
     */
    public List<FeedItem> getFeed(Long userId, int limit) {
        Set<Long> friendIds = friendshipService.getFirstDegreeConnections(userId);
        if (friendIds.isEmpty()) return List.of();

        // Pre-fetch user names
        Map<Long, String> userNames = userRepository.findAllById(friendIds).stream()
                .collect(Collectors.toMap(u -> u.getId(), u -> u.getName()));

        java.util.List<FeedItem> items = new java.util.ArrayList<>();

        // Collect all spot IDs we'll need to look up
        java.util.Set<Long> allSpotIds = new java.util.HashSet<>();

        // 1. Recent reviews by friends
        List<Review> friendReviews = reviewRepository.findRecentByAuthorIds(friendIds, limit);
        for (Review r : friendReviews) {
            allSpotIds.add(r.getSpotId());
        }

        // 2. Recent spot events by friends (views, saves)
        List<SpotEvent> friendEvents = spotEventRepository.findRecentByUserIds(friendIds, limit);
        for (SpotEvent e : friendEvents) {
            if (e.getUserId() != null) allSpotIds.add(e.getSpotId());
        }

        // 3. Recent likes/saves by friends
        List<UserSpotInteraction> friendInteractions = interactionRepository.findRecentByUserIds(friendIds, limit);
        for (UserSpotInteraction i : friendInteractions) {
            allSpotIds.add(i.getSpotId());
        }

        // Pre-fetch all spots in one query
        Map<Long, Spot> spotMap = spotRepository.findAllById(allSpotIds).stream()
                .collect(Collectors.toMap(Spot::getId, s -> s));

        // Build feed items with spot details
        for (Review r : friendReviews) {
            Spot spot = spotMap.get(r.getSpotId());
            items.add(new FeedItem(
                    r.getAuthorId(),
                    userNames.getOrDefault(r.getAuthorId(), "Friend"),
                    "REVIEW",
                    r.getSpotId(),
                    spot != null ? spot.getName() : "Unknown spot",
                    spot != null ? spot.getAddress() : null,
                    "left a " + r.getRating() + "-star review",
                    r.getCreatedAt()
            ));
        }

        for (SpotEvent e : friendEvents) {
            if (e.getUserId() == null) continue;
            Spot spot = spotMap.get(e.getSpotId());
            String action = switch (e.getEventType()) {
                case VIEW -> "viewed";
                case SAVE -> "saved";
            };
            items.add(new FeedItem(
                    e.getUserId(),
                    userNames.getOrDefault(e.getUserId(), "Friend"),
                    e.getEventType().name(),
                    e.getSpotId(),
                    spot != null ? spot.getName() : "Unknown spot",
                    spot != null ? spot.getAddress() : null,
                    action,
                    e.getCreatedAt()
            ));
        }

        for (UserSpotInteraction i : friendInteractions) {
            Spot spot = spotMap.get(i.getSpotId());
            if (i.isLiked()) {
                items.add(new FeedItem(
                        i.getUserId(),
                        userNames.getOrDefault(i.getUserId(), "Friend"),
                        "LIKE",
                        i.getSpotId(),
                        spot != null ? spot.getName() : "Unknown spot",
                        spot != null ? spot.getAddress() : null,
                        "liked",
                        i.getUpdatedAt()
                ));
            }
            if (i.isSaved()) {
                items.add(new FeedItem(
                        i.getUserId(),
                        userNames.getOrDefault(i.getUserId(), "Friend"),
                        "SAVE",
                        i.getSpotId(),
                        spot != null ? spot.getName() : "Unknown spot",
                        spot != null ? spot.getAddress() : null,
                        "saved",
                        i.getUpdatedAt()
                ));
            }
        }

        // Sort by timestamp descending and limit
        return items.stream()
                .sorted((a, b) -> b.timestamp().compareTo(a.timestamp()))
                .limit(limit)
                .toList();
    }

    public record FeedItem(
            Long userId,
            String userName,
            String activityType,
            Long spotId,
            String spotName,
            String spotAddress,
            String description,
            java.time.Instant timestamp
    ) {}
}
