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

    private final EventRepository eventRepository;
    private final JourneyRepository journeyRepository;
    private final FollowService followService;

    public FeedService(
            SpotEventRepository spotEventRepository,
            ReviewRepository reviewRepository,
            UserSpotInteractionRepository interactionRepository,
            FriendshipService friendshipService,
            UserRepository userRepository,
            SpotRepository spotRepository,
            FeedPostRepository feedPostRepository,
            PostLikeRepository postLikeRepository,
            PostCommentRepository postCommentRepository,
            EventRepository eventRepository,
            JourneyRepository journeyRepository,
            FollowService followService
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
        this.eventRepository = eventRepository;
        this.journeyRepository = journeyRepository;
        this.followService = followService;
    }

    /**
     * Build the feed based on filter.
     * filter can be "friends", "experts", "trusted", "global", "all", "user".
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
        } else if (filter.equalsIgnoreCase("trusted")) {
            // Trusted = friends + experts you follow
            relevantUserIds.addAll(friendIds);
            relevantUserIds.addAll(followService.getFollowedExpertIds(userId));
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
        if (filter.equalsIgnoreCase("friends") || filter.equalsIgnoreCase("trusted") || filter.equalsIgnoreCase("user")) {
            // if filter is "user", we can also show interactions of that user
            Set<Long> idsToFetch = filter.equalsIgnoreCase("user") ? Set.of(targetUserId) : relevantUserIds;
            
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

        // Also collect spotIds, eventIds, journeyIds from feed posts
        Set<Long> allEventIds = new HashSet<>();
        Set<Long> allJourneyIds = new HashSet<>();
        for (FeedPost p : feedPosts) {
            if (p.getSpotIds() != null) allSpotIds.addAll(p.getSpotIds());
            if (p.getEventIds() != null) allEventIds.addAll(p.getEventIds());
            if (p.getJourneyIds() != null) allJourneyIds.addAll(p.getJourneyIds());
        }

        // Prefetch spots, events, and journeys
        Map<Long, Spot> spotMap = spotRepository.findAllById(allSpotIds).stream()
                .collect(Collectors.toMap(Spot::getId, s -> s));
        Map<Long, Event> eventMap = eventRepository.findAllById(allEventIds).stream()
                .collect(Collectors.toMap(Event::getId, e -> e));
        Map<Long, Journey> journeyMap = journeyRepository.findAllById(allJourneyIds).stream()
                .collect(Collectors.toMap(Journey::getId, j -> j));

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
            boolean authorIsAdmin = author != null && (author.getRole() == Role.ADMIN || author.getRole() == Role.SUPER_ADMIN);
            items.add(new FeedItem(
                    null, r.getAuthorId(),
                    author != null ? author.getName() : "Unknown",
                    author != null ? author.getProfilePicture() : null,
                    author != null && author.isExpert(), authorIsAdmin,
                    "REVIEW",
                    r.getSpotId(), spot != null ? spot.getName() : "Unknown spot", spot != null ? spot.getAddress() : null,
                    null, null, null, null,
                    r.getBody(), r.getCreatedAt(),
                    null, 0, false, List.of(), List.of(),
                    null, null, null
            ));
        }

        for (SpotEvent e : events) {
            if (e.getUserId() == null) continue;
            if (e.getEventType() == SpotEvent.EventType.VIEW) continue;
            Spot spot = spotMap.get(e.getSpotId());
            User author = userMap.get(e.getUserId());
            boolean authorIsAdmin = author != null && (author.getRole() == Role.ADMIN || author.getRole() == Role.SUPER_ADMIN);
            items.add(new FeedItem(
                    null, e.getUserId(),
                    author != null ? author.getName() : "Unknown",
                    author != null ? author.getProfilePicture() : null,
                    author != null && author.isExpert(), authorIsAdmin,
                    e.getEventType().name(),
                    e.getSpotId(), spot != null ? spot.getName() : "Unknown spot", spot != null ? spot.getAddress() : null,
                    null, null, null, null,
                    "saved", e.getCreatedAt(),
                    null, 0, false, List.of(), List.of(),
                    null, null, null
            ));
        }

        for (UserSpotInteraction i : interactions) {
            Spot spot = spotMap.get(i.getSpotId());
            User author = userMap.get(i.getUserId());
            boolean authorIsAdmin = author != null && (author.getRole() == Role.ADMIN || author.getRole() == Role.SUPER_ADMIN);
            if (i.isLiked()) {
                items.add(new FeedItem(
                        null, i.getUserId(),
                        author != null ? author.getName() : "Unknown",
                        author != null ? author.getProfilePicture() : null,
                        author != null && author.isExpert(), authorIsAdmin,
                        "LIKE",
                        i.getSpotId(), spot != null ? spot.getName() : "Unknown spot", spot != null ? spot.getAddress() : null,
                        null, null, null, null,
                        "liked", i.getUpdatedAt(),
                        null, 0, false, List.of(), List.of(),
                        null, null, null
                ));
            }
            if (i.isSaved()) {
                items.add(new FeedItem(
                        null, i.getUserId(),
                        author != null ? author.getName() : "Unknown",
                        author != null ? author.getProfilePicture() : null,
                        author != null && author.isExpert(), authorIsAdmin,
                        "SAVE",
                        i.getSpotId(), spot != null ? spot.getName() : "Unknown spot", spot != null ? spot.getAddress() : null,
                        null, null, null, null,
                        "saved", i.getUpdatedAt(),
                        null, 0, false, List.of(), List.of(),
                        null, null, null
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
            List<LikeRecord> postLikers = postLikes.stream()
                    .map(l -> {
                        User lAuthor = userMap.get(l.getUserId());
                        return new LikeRecord(l.getUserId(), lAuthor != null ? lAuthor.getName() : "Unknown");
                    })
                    .toList();

            // Build lists of linked items
            List<LinkedSpot> linkedSpots = (p.getSpotIds() != null ? p.getSpotIds() : List.<Long>of()).stream()
                    .map(id -> {
                        Spot s = spotMap.get(id);
                        return s != null ? new LinkedSpot(s.getId(), s.getName(), s.getAddress()) : null;
                    })
                    .filter(Objects::nonNull)
                    .toList();

            List<LinkedEvent> linkedEvents = (p.getEventIds() != null ? p.getEventIds() : List.<Long>of()).stream()
                    .map(id -> {
                        Event ev = eventMap.get(id);
                        return ev != null ? new LinkedEvent(ev.getId(), ev.getTitle()) : null;
                    })
                    .filter(Objects::nonNull)
                    .toList();

            List<LinkedJourney> linkedJourneys = (p.getJourneyIds() != null ? p.getJourneyIds() : List.<Long>of()).stream()
                    .map(id -> {
                        Journey j = journeyMap.get(id);
                        return j != null ? new LinkedJourney(j.getId(), j.getName()) : null;
                    })
                    .filter(Objects::nonNull)
                    .toList();

            // Keep first ID for backward compat
            Long firstSpotId = linkedSpots.isEmpty() ? null : linkedSpots.get(0).id();
            Long firstEventId = linkedEvents.isEmpty() ? null : linkedEvents.get(0).id();
            Long firstJourneyId = linkedJourneys.isEmpty() ? null : linkedJourneys.get(0).id();

            boolean authorIsAdmin = author != null && (author.getRole() == Role.ADMIN || author.getRole() == Role.SUPER_ADMIN);
            items.add(new FeedItem(
                    p.getId(), p.getAuthorId(),
                    author != null ? author.getName() : "Unknown",
                    author != null ? author.getProfilePicture() : null,
                    author != null && author.isExpert(), authorIsAdmin,
                    "POST",
                    firstSpotId,
                    linkedSpots.isEmpty() ? null : linkedSpots.get(0).name(),
                    linkedSpots.isEmpty() ? null : linkedSpots.get(0).address(),
                    firstEventId,
                    linkedEvents.isEmpty() ? null : linkedEvents.get(0).title(),
                    firstJourneyId,
                    linkedJourneys.isEmpty() ? null : linkedJourneys.get(0).name(),
                    p.getContent(), p.getCreatedAt(),
                    p.getMediaUrls(),
                    postLikes.size(), hasLiked, postComments, postLikers,
                    linkedSpots, linkedEvents, linkedJourneys
            ));
        }

        // Sort by timestamp descending and limit
        return items.stream()
                .sorted((a, b) -> b.timestamp().compareTo(a.timestamp()))
                .limit(limit)
                .toList();
    }

    public record CommentRecord(Long id, Long authorId, String authorName, String content, Instant createdAt) {}
    public record LikeRecord(Long userId, String userName) {}
    public record LinkedSpot(Long id, String name, String address) {}
    public record LinkedEvent(Long id, String title) {}
    public record LinkedJourney(Long id, String name) {}

    public record FeedItem(
            Long postId, Long userId, String userName, String userProfilePicture,
            boolean isExpert, boolean isAdmin,
            String activityType,
            Long spotId, String spotName, String spotAddress,
            Long eventId, String eventName,
            Long journeyId, String journeyName,
            String description, Instant timestamp,
            List<String> mediaUrls,
            int likeCount, boolean hasLiked,
            List<CommentRecord> comments, List<LikeRecord> likers,
            List<LinkedSpot> linkedSpots, List<LinkedEvent> linkedEvents, List<LinkedJourney> linkedJourneys
    ) {}
}