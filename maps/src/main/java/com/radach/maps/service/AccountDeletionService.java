package com.radach.maps.service;

import java.util.List;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.exception.ResourceNotFoundException;
import com.radach.maps.model.CalendarEntry;
import com.radach.maps.model.EventLike;
import com.radach.maps.model.Friendship;
import com.radach.maps.model.Notification;
import com.radach.maps.model.JourneyUpvote;
import com.radach.maps.model.User;
import com.radach.maps.model.UserSpotInteraction;
import com.radach.maps.repository.CalendarEntryRepository;
import com.radach.maps.repository.EventLikeRepository;
import com.radach.maps.repository.FriendshipRepository;
import com.radach.maps.repository.JourneyUpvoteRepository;
import com.radach.maps.repository.NotificationRepository;
import com.radach.maps.repository.RefreshTokenRepository;
import com.radach.maps.repository.UserRepository;
import com.radach.maps.repository.UserSpotInteractionRepository;

@Service
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final CalendarEntryRepository calendarEntryRepository;
    private final EventLikeRepository eventLikeRepository;
    private final JourneyUpvoteRepository journeyUpvoteRepository;
    private final UserSpotInteractionRepository userSpotInteractionRepository;
    private final NotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountDeletionService(UserRepository userRepository,
                                  FriendshipRepository friendshipRepository,
                                  RefreshTokenRepository refreshTokenRepository,
                                  CalendarEntryRepository calendarEntryRepository,
                                  EventLikeRepository eventLikeRepository,
                                  JourneyUpvoteRepository journeyUpvoteRepository,
                                  UserSpotInteractionRepository userSpotInteractionRepository,
                                  NotificationRepository notificationRepository,
                                  PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.friendshipRepository = friendshipRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.calendarEntryRepository = calendarEntryRepository;
        this.eventLikeRepository = eventLikeRepository;
        this.journeyUpvoteRepository = journeyUpvoteRepository;
        this.userSpotInteractionRepository = userSpotInteractionRepository;
        this.notificationRepository = notificationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void deleteAndAnonymizeUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // 1. Delete friendships
        List<Friendship> friendships = friendshipRepository.findAllFriendshipsByUserId(userId);
        friendshipRepository.deleteAll(friendships);

        // 2. Delete refresh tokens
        refreshTokenRepository.deleteByUserId(userId);

        // 3. Delete calendar entries
        List<CalendarEntry> calendarEntries = calendarEntryRepository.findByUserId(userId);
        calendarEntryRepository.deleteAll(calendarEntries);

        // 4. Delete event likes
        List<EventLike> eventLikes = eventLikeRepository.findByUserId(userId);
        eventLikeRepository.deleteAll(eventLikes);

        // 5. Delete journey upvotes
        List<JourneyUpvote> upvotes = journeyUpvoteRepository.findByUserId(userId);
        journeyUpvoteRepository.deleteAll(upvotes);

        // 6. Delete spot interactions (likes, saves, etc.)
        List<UserSpotInteraction> interactions = userSpotInteractionRepository.findByUserId(userId);
        userSpotInteractionRepository.deleteAll(interactions);

        // 7. Delete notifications
        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        notificationRepository.deleteAll(notifications);

        // 8. Anonymize user profile
        user.setName("Deleted User");
        // Randomize email to release the original email for potential future registration
        user.setEmail("deleted-" + UUID.randomUUID().toString() + "@radach.com");
        // Randomize password to render future logins impossible
        user.setPasswordHash(passwordEncoder.encode("DELETED-" + UUID.randomUUID().toString()));
        user.setBio(null);
        user.setProfilePicture(null);
        user.setProfessionalTitle(null);
        user.setOrganization(null);
        user.setYearsExperience(null);
        user.setSpecializations(null);
        user.setPortfolioUrl(null);
        user.setExpert(false);
        user.setPrivateAccount(true);

        userRepository.save(user);
    }
}
