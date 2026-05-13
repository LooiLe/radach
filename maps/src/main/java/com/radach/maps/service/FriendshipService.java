package com.radach.maps.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.radach.maps.model.Friendship;
import com.radach.maps.repository.FriendshipRepository;
import com.radach.maps.repository.UserRepository;

@Service
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    public FriendshipService(FriendshipRepository friendshipRepository, UserRepository userRepository) {
        this.friendshipRepository = friendshipRepository;
        this.userRepository = userRepository;
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

        // Remove the user themselves and their direct 1st-degree friends
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

        return friendshipRepository.findByUsers(requesterId, addresseeId)
                .orElseGet(() -> {
                    Friendship f = new Friendship();
                    f.setRequesterId(requesterId);
                    f.setAddresseeId(addresseeId);
                    f.setStatus(Friendship.Status.PENDING);
                    return friendshipRepository.save(f);
                });
    }

    @Transactional
    public Friendship acceptRequest(Long userId, Long friendshipId) {
        Friendship f = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new IllegalArgumentException("Friendship not found"));

        if (!f.getAddresseeId().equals(userId)) {
            throw new IllegalArgumentException("Not authorized to accept this request");
        }

        f.setStatus(Friendship.Status.ACCEPTED);
        return friendshipRepository.save(f);
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
