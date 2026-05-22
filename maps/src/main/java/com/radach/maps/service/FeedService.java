package com.radach.maps.service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import com.radach.maps.model.*;
import com.radach.maps.repository.*;
import org.springframework.stereotype.Service;

@Service
public class FeedService {

    private final SpotEventRepository spotEventRepository;
    private final ReviewRepository reviewRepository;
    private final UserSpotInteractionRepository interactionRepository;
    private final FriendshipService friendshipService;
    private final UserRepository userRepository;
    private final SpotRepository spotRepository;
    private final FeedPostRepository feedPostRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostCommentRepository postCommentRepository;

    public FeedService(
            SpotEventRepository spotEventRepository,
            ReviewRepository reviewRepository,
            UserSpotInteractionRepository interactionRepository,
            FriendshipService friendshipService,
            UserRepository userRepository,
            SpotRepository spotRepository,
            FeedPostRepository feedPostRepository,
            PostLikeRepository postLikeRepository,
            PostCommentRepository postCommentRepository
    ) {
        this.spotEventRepository = spotEventRepository;
        this.reviewRepository = reviewRepository;
        this.interactionRepository = interactionRepository;
        this.friendshipService = friendshipService;
        this.userRepository = userRepository;
        this.spotRepository = spotRepository;
        this.feedPostRepository = feedPostRepository;
        this.postLikeRepository = postLikeRepository;
        this.postCommentRepository = postCommentRepository;
    }

    /**
     * Build the feed based on filter.
     * filter can be "friends", "experts", "global", "all", "user".
     */
    public List<FeedItem> getFeed(Long userId, String filter, int limit, Long targetUserId) {
        if (filter == null) filter = "global";

        List<FeedItem> items = new ArrayList<>();
        Set<Long> relevantUserIds = new HashSet<>();
        
        List<User> allUsersList = userRepository.findAll();
        Map<Long, User> userMap = allUsersList.stream().collect(Collectors.toMap(User::getId, u -> u));

        Set<Long> friendIds = friendshipService.getFirstDegreeConnections(userId);

        if (filter.equalsIgnoreCase("friends")) {
            relevantUserIds.addAll(friendIds);
        } else if (filter.equalsIgnoreCase("experts")) {
            relevantUserIds = allUsersList.stream()
                    .filter(User::isExpert)
                    .map(User::getId)
                    .collect(Collectors.toSet());
        } else if (filter.equalsIgnoreCase("user") && targetUserId != null) {
            relevantUserIds.add(targetUserId);
        } else {
            // Global / All
            relevantUserIds = allUsersList.stream()
                    .filter(u -> u.isExpert() || !u.isPrivateAccount() || friendIds.contains(u.getId()))
                    .map(User::getId)
                    .collect(Collectors.toSet());
        }

        if (relevantUserIds.isEmpty()) return List.of();

        Set<Long> allSpotIds = new HashSet<>();

        // 1. Fetch Reviews
        List<Review> reviews = reviewRepository.findRecentByAuthorIds(relevantUserIds, limit);
        for (Review r : reviews) allSpotIds.add(r.getSpotId());

        // 2. Fetch interactions (only if friends filter, to avoid spamming global feed with likes/views)
        List<SpotEvent> events = new ArrayList<>();
        List<UserSpotInteraction> interactions = new ArrayList<>();
        if (filter.equalsIgnoreCase("friends") || filter.equalsIgnoreCase("user")) {
            // if filter is "user", we can also show interactions of that user
            Set<Long> idsToFetch = filter.equalsIgnoreCase("user") ? Set.of(targetUserId) : friendIds;
            
            events = spotEventRepository.findRecentByUserIds(idsToFetch, limit);
            for (SpotEvent e : events) {
                if (e.getUserId() != null) allSpotIds.add(e.getSpotId());
            }

            interactions = interactionRepository.findRecentByUserIds(idsToFetch, limit);
            for (UserSpotInteraction i : interactions) {
                allSpotIds.add(i.getSpotId());
            }
        }

        // 3. Fetch FeedPosts
        List<FeedPost> feedPosts = feedPostRepository.findByAuthorIdInOrderByCreatedAtDesc(relevantUserIds);
        if (feedPosts.size() > limit) {
            feedPosts = feedPosts.subList(0, limit);
        }

        // Also collect spotIds from feed posts
        for (FeedPost p : feedPosts) {
            if (p.getSpotId() != null) allSpotIds.add(p.getSpotId());
        }

        // Prefetch spots
        Map<Long, Spot> spotMap = spotRepository.findAllById(allSpotIds).stream()
                .collect(Collectors.toMap(Spot::getId, s -> s));

        // Prefetch post likes & comments
        List<Long> postIds = feedPosts.stream().map(FeedPost::getId).toList();
        Map<Long, List<PostLike>> likesMap = postLikeRepository.findByPostIdIn(postIds).stream()
                .collect(Collectors.groupingBy(PostLike::getPostId));
        Map<Long, List<PostComment>> commentsMap = postCommentRepository.findByPostIdInOrderByCreatedAtAsc(postIds).stream()
                .collect(Collectors.groupingBy(PostComment::getPostId));

        // Assemble FeedItems
        for (Review r : reviews) {
            Spot spot = spotMap.get(r.getSpotId());
            User author = userMap.get(r.getAuthorId());
            items.add(new FeedItem(
                    null, // Not a FeedPost
                    r.getAuthorId(),
                    author != null ? author.getName() : "Unknown",
                    author != null && author.isExpert(),
                    "REVIEW",
                    r.getSpotId(),
                    spot != null ? spot.getName() : "Unknown spot",
                    spot != null ? spot.getAddress() : null,
                    r.getBody(),
                    r.getCreatedAt(),
                    null, 0, false, List.of()
            ));
        }

        for (SpotEvent e : events) {
            if (e.getUserId() == null) continue;
            Spot spot = spotMap.get(e.getSpotId());
            User author = userMap.get(e.getUserId());
            String action = e.getEventType() == SpotEvent.EventType.VIEW ? "viewed" : "saved";
            items.add(new FeedItem(
                    null,
                    e.getUserId(),
                    author != null ? author.getName() : "Unknown",
                    author != null && author.isExpert(),
                    e.getEventType().name(),
                    e.getSpotId(),
                    spot != null ? spot.getName() : "Unknown spot",
                    spot != null ? spot.getAddress() : null,
                    action,
                    e.getCreatedAt(),
                    null, 0, false, List.of()
            ));
        }

        for (UserSpotInteraction i : interactions) {
            Spot spot = spotMap.get(i.getSpotId());
            User author = userMap.get(i.getUserId());
            if (i.isLiked()) {
                items.add(new FeedItem(
                        null,
                        i.getUserId(),
                        author != null ? author.getName() : "Unknown",
                        author != null && author.isExpert(),
                        "LIKE",
                        i.getSpotId(),
                        spot != null ? spot.getName() : "Unknown spot",
                        spot != null ? spot.getAddress() : null,
                        "liked",
                        i.getUpdatedAt(),
                        null, 0, false, List.of()
                ));
            }
            if (i.isSaved()) {
                items.add(new FeedItem(
                        null,
                        i.getUserId(),
                        author != null ? author.getName() : "Unknown",
                        author != null && author.isExpert(),
                        "SAVE",
                        i.getSpotId(),
                        spot != null ? spot.getName() : "Unknown spot",
                        spot != null ? spot.getAddress() : null,
                        "saved",
                        i.getUpdatedAt(),
                        null, 0, false, List.of()
                ));
            }
        }

        for (FeedPost p : feedPosts) {
            User author = userMap.get(p.getAuthorId());
            List<PostLike> postLikes = likesMap.getOrDefault(p.getId(), List.of());
            boolean hasLiked = postLikes.stream().anyMatch(l -> l.getUserId().equals(userId));
            List<CommentRecord> postComments = commentsMap.getOrDefault(p.getId(), List.of()).stream()
                    .map(c -> {
                        User cAuthor = userMap.get(c.getAuthorId());
                        return new CommentRecord(c.getId(), c.getAuthorId(), cAuthor != null ? cAuthor.getName() : "Unknown", c.getContent(), c.getCreatedAt());
                    })
                    .toList();

            Spot postSpot = p.getSpotId() != null ? spotMap.get(p.getSpotId()) : null;
            items.add(new FeedItem(
                    p.getId(),
                    p.getAuthorId(),
                    author != null ? author.getName() : "Unknown",
                    author != null && author.isExpert(),
                    "POST",
                    p.getSpotId(),
                    postSpot != null ? postSpot.getName() : null,
                    postSpot != null ? postSpot.getAddress() : null,
                    p.getContent(),
                    p.getCreatedAt(),
                    p.getMediaUrls(),
                    postLikes.size(),
                    hasLiked,
                    postComments
            ));
        }

        // Sort by timestamp descending and limit
        return items.stream()
                .sorted((a, b) -> b.timestamp().compareTo(a.timestamp()))
                .limit(limit)
                .toList();
    }

    public record CommentRecord(
            Long id,
            Long authorId,
            String authorName,
            String content,
            Instant createdAt
    ) {}

    public record FeedItem(
            Long postId,
            Long userId,
            String userName,
            boolean isExpert,
            String activityType, // REVIEW, LIKE, SAVE, VIEW, POST
            Long spotId,
            String spotName,
            String spotAddress,
            String description,
            Instant timestamp,
            List<String> mediaUrls,
            int likeCount,
            boolean hasLiked,
            List<CommentRecord> comments
    ) {}
}
