package com.radach.maps.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.Friendship;
import com.radach.maps.model.User;
import com.radach.maps.repository.FriendshipRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public FriendshipService(FriendshipRepository friendshipRepository, UserRepository userRepository,
                             NotificationService notificationService) {
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    public Set<Long> getFirstDegreeConnections(Long userId) {
        return friendshipRepository.findAcceptedFriendshipsByUserId(userId).stream()
                .map(f -> f.getRequesterId().equals(userId) ? f.getAddresseeId() : f.getRequesterId())
                .collect(Collectors.toSet());
    }

    public Set<Long> getSecondDegreeConnections(Long userId) {
        Set<Long> firstDegree = getFirstDegreeConnections(userId);
        Set<Long> secondDegree = new HashSet<>();

        for (Long friendId : firstDegree) {
            Set<Long> friendsOfFriend = getFirstDegreeConnections(friendId);
            secondDegree.addAll(friendsOfFriend);
        }

        secondDegree.remove(userId);
        secondDegree.removeAll(firstDegree);

        return secondDegree;
    }

    @Transactional
    public Friendship sendRequest(Long requesterId, Long addresseeId) {
        if (requesterId.equals(addresseeId)) {
            throw new IllegalArgumentException("Cannot send friend request to yourself");
        }
        userRepository.findById(addresseeId).orElseThrow(() -> new IllegalArgumentException("User not found"));

        Friendship f = friendshipRepository.findByUsers(requesterId, addresseeId)
                .orElseGet(() -> {
                    Friendship fr = new Friendship();
                    fr.setRequesterId(requesterId);
                    fr.setAddresseeId(addresseeId);
                    fr.setStatus(Friendship.Status.PENDING);
                    return friendshipRepository.save(fr);
                });

        // Notify addressee
        User requester = userRepository.findById(requesterId).orElse(null);
        String requesterName = requester != null ? requester.getName() : "Someone";
        notificationService.createNotification(
                addresseeId,
                "FRIEND_REQUEST",
                requesterName + " sent you a friend request",
                f.getId(),
                "FRIENDSHIP"
        );

        return f;
    }

    @Transactional
    public Friendship acceptRequest(Long userId, Long friendshipId) {
        Friendship f = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));

        if (!f.getAddresseeId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to accept this request");
        }

        f.setStatus(Friendship.Status.ACCEPTED);
        Friendship saved = friendshipRepository.save(f);

        // Notify requester
        User accepter = userRepository.findById(userId).orElse(null);
        String accepterName = accepter != null ? accepter.getName() : "Someone";
        notificationService.createNotification(
                f.getRequesterId(),
                "FRIEND_ACCEPTED",
                accepterName + " accepted your friend request",
                f.getId(),
                "FRIENDSHIP"
        );

        return saved;
    }

    @Transactional
    public void rejectOrCancelRequest(Long userId, Long friendshipId) {
        Friendship f = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));

        if (!f.getAddresseeId().equals(userId) && !f.getRequesterId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to modify this request");
        }

        friendshipRepository.delete(f);
    }

    public List<Friendship> getPendingRequestsForMe(Long userId) {
        return friendshipRepository.findPendingRequestsForUser(userId);
    }
}